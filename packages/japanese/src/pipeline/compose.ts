import type { RomajiMode } from "../config"
import { buildPhrases } from "../rules/phrase"
import { buildWordDrafts } from "../rules/word"
import type { WordDraft } from "../rules/word"
import type { Morpheme, Phrase, Word } from "../types"
import {
  joinRuby,
  kanaToRomaji,
  toHiraganaReading,
  usableReading
} from "./reading"

/** Helper verbs (みる, いる, しまう) read as a separate romaji word. */
function startsRomajiWord(morpheme: Morpheme): boolean {
  return morpheme.pos === "動詞" && morpheme.posDetail[0] === "非自立"
}

function wordRomaji(parts: Morpheme[], mode: RomajiMode): string | null {
  if (mode === false) return null
  const [only] = parts
  if (parts.length === 1 && only) return only.romaji

  const groups: string[][] = []
  for (const part of parts) {
    const reading = usableReading(part)
    if (reading === null) return null
    const current = groups.at(-1)
    if (current && !startsRomajiWord(part)) {
      current.push(reading)
    } else {
      groups.push([reading])
    }
  }
  // Romanize whole groups so っ/ん at morpheme boundaries resolve (思っ|て → omotte).
  return groups.map((group) => kanaToRomaji(group.join(""))).join(" ")
}

function wordReading(parts: Morpheme[]): string | null {
  const readings: string[] = []
  for (const part of parts) {
    const reading = usableReading(part)
    if (reading === null) return null
    readings.push(reading)
  }
  return toHiraganaReading(readings.join(""))
}

function toWord(
  text: string,
  morphemes: readonly Morpheme[],
  draft: WordDraft,
  index: number,
  mode: RomajiMode
): Word {
  const parts = draft.morphemeIndexes.flatMap((i) => {
    const morpheme = morphemes[i]
    return morpheme ? [morpheme] : []
  })
  const start = parts[0]?.start ?? 0
  const end = parts.at(-1)?.end ?? start
  const tailMorpheme =
    draft.tailStart === null ? undefined : morphemes[draft.tailStart]

  return {
    baseForm: draft.baseForm,
    end,
    index,
    isPunctuation: parts.every((part) => part.isPunctuation),
    morphemeIndexes: draft.morphemeIndexes,
    pos: draft.pos,
    reading: wordReading(parts),
    romaji: wordRomaji(parts, mode),
    ruby: joinRuby(parts),
    start,
    surface: text.slice(start, end),
    tail: tailMorpheme ? { end, start: tailMorpheme.start } : null
  }
}

export function compose(
  text: string,
  morphemes: readonly Morpheme[],
  mode: RomajiMode
): { words: Word[]; phrases: Phrase[] } {
  const words = buildWordDrafts(morphemes).map((draft, index) =>
    toWord(text, morphemes, draft, index, mode)
  )
  return { phrases: buildPhrases(words), words }
}
