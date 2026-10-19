import type { EngineId, RawMorpheme } from "./engine"

/** Must stay equal to `JapanesePartOfSpeech` in apps/web/src/lib/japanese-pos.ts. */
export type LearnerPos =
  | "noun"
  | "pronoun"
  | "verb"
  | "adjective"
  | "adverb"
  | "particle"
  | "auxiliary"
  | "expression"

export interface RubySegment {
  text: string
  /** Hiragana, present only on kanji runs. */
  reading?: string
}

export interface Morpheme extends RawMorpheme {
  learnerPos: LearnerPos
  isPunctuation: boolean
  ruby: RubySegment[] | null
  romaji: string | null
}

export interface TextSpan {
  start: number
  end: number
}

export interface Word {
  index: number
  start: number
  end: number
  surface: string
  morphemeIndexes: number[]
  pos: LearnerPos
  baseForm: string
  /** Hiragana. */
  reading: string | null
  ruby: RubySegment[] | null
  romaji: string | null
  isPunctuation: boolean
  /** Inflection/auxiliary span after the head (てみました in 食べてみました). */
  tail: TextSpan | null
}

export interface Phrase {
  index: number
  start: number
  end: number
  wordIndexes: number[]
}

export interface AnalyzedText {
  text: string
  engine: { id: EngineId; dictVersion: string }
  containsJapanese: boolean
  morphemes: Morpheme[]
  words: Word[]
  phrases: Phrase[]
}
