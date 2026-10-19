import { resolveAnalyzerConfig } from "./config"
import type {
  AnalyzerConfig,
  ResolvedAnalyzerConfig,
  RomajiMode
} from "./config"
import type { RawMorpheme, TokenizerEngine } from "./engine"
import { JapaneseAnalyzerError } from "./errors"
import { classifyLearnerPos, isPunctuationMorpheme } from "./pipeline/classify"
import { compose } from "./pipeline/compose"
import { morphemeRomaji, morphemeRuby } from "./pipeline/reading"
import type { AnalyzedText, Morpheme } from "./types"

// No normalize stage yet: NFKC changes string length (ｶﾞ → ガ, ㍿ → 株式会社),
// which would break offsets into the original text. It needs an offset map first.

const JAPANESE_CHAR =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆]/u

export interface JapaneseAnalyzer {
  analyze(text: string): Promise<AnalyzedText>
}

async function tokenize(
  engine: TokenizerEngine,
  text: string
): Promise<RawMorpheme[]> {
  let raw: RawMorpheme[]
  try {
    raw = await engine.tokenize(text)
  } catch (error) {
    throw new JapaneseAnalyzerError(
      "ENGINE_UNAVAILABLE",
      `Tokenizer engine "${engine.id}" failed`,
      { cause: error }
    )
  }
  if (raw.length === 0) {
    throw new JapaneseAnalyzerError(
      "ENGINE_UNAVAILABLE",
      `Tokenizer engine "${engine.id}" returned no morphemes for non-empty input`
    )
  }
  for (const morpheme of raw) {
    if (text.slice(morpheme.start, morpheme.end) !== morpheme.surface) {
      throw new JapaneseAnalyzerError(
        "ENGINE_UNAVAILABLE",
        `Tokenizer engine "${engine.id}" returned offsets ${morpheme.start}-${morpheme.end} that do not match "${morpheme.surface}"`
      )
    }
  }
  return raw
}

function enrich(raw: RawMorpheme, mode: RomajiMode): Morpheme {
  const isPunctuation = isPunctuationMorpheme(raw)
  return {
    ...raw,
    isPunctuation,
    learnerPos: isPunctuation ? "expression" : classifyLearnerPos(raw),
    romaji: mode === false ? null : morphemeRomaji(raw),
    ruby: morphemeRuby(raw)
  }
}

async function analyzeText(
  config: ResolvedAnalyzerConfig,
  text: string
): Promise<AnalyzedText> {
  if (text.trim().length === 0) {
    throw new JapaneseAnalyzerError("EMPTY_INPUT", "Text to analyze is empty")
  }
  if (text.length > config.maxChars) {
    throw new JapaneseAnalyzerError(
      "INPUT_TOO_LONG",
      `Text is ${text.length} characters long; the limit is ${config.maxChars}`
    )
  }

  const raw = await tokenize(config.engine, text)
  const morphemes = raw.map((morpheme) => enrich(morpheme, config.romaji))
  const { words, phrases } = compose(text, morphemes, config.romaji)

  return {
    containsJapanese: JAPANESE_CHAR.test(text),
    engine: {
      dictVersion: config.engine.dictVersion,
      id: config.engine.id
    },
    morphemes,
    phrases,
    text,
    words
  }
}

export function createAnalyzer(config: AnalyzerConfig): JapaneseAnalyzer {
  const resolved = resolveAnalyzerConfig(config)
  return { analyze: (text) => analyzeText(resolved, text) }
}
