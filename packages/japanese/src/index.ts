// Core entry: must stay pure TypeScript (no node:*, DOM, or engine imports)
// because it also runs on Hermes.
export { createAnalyzer } from "./analyzer"
export type { JapaneseAnalyzer } from "./analyzer"
export { DEFAULT_MAX_CHARS } from "./config"
export type { AnalyzerConfig, RomajiMode } from "./config"
export type {
  EngineCapabilities,
  EngineId,
  RawMorpheme,
  TokenizerEngine
} from "./engine"
export { JapaneseAnalyzerError } from "./errors"
export { splitArticle, chunkSentences } from "./import/article"
export { parseWordList, guessColumnRoles } from "./import/wordlist"
export type {
  WordListFormat,
  WordListIssue,
  ColumnRole
} from "./import/wordlist"
// Used directly by UIs that show dictionary headwords (no tokenizing needed).
export { alignRuby, kanaToRomaji } from "./pipeline/reading"
export type { JapaneseAnalyzerErrorCode } from "./errors"
export type { DictionaryLoader } from "./loaders/types"
export type {
  AnalyzedText,
  LearnerPos,
  Morpheme,
  Phrase,
  RubySegment,
  TextSpan,
  Word
} from "./types"

export { htmlToJapaneseText, decodeJapaneseBytes } from "./import/html"
