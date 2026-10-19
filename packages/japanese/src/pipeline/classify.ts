import type { RawMorpheme } from "../engine"
import type { LearnerPos } from "../types"

// IPADIC tags mapping. Rules here are IPADIC-specific; a UniDic engine will
// need its own table keyed by engine id.

const PUNCTUATION_ONLY = /^[\p{P}\p{S}\s]+$/u
const HAS_LETTER_OR_NUMBER = /[\p{L}\p{N}]/u

const POS_TABLE: Record<string, LearnerPos> = {
  副詞: "adverb",
  助動詞: "auxiliary",
  助詞: "particle",
  動詞: "verb",
  形容詞: "adjective",
  連体詞: "adjective",
  接続詞: "expression",
  感動詞: "expression",
  フィラー: "expression",
  その他: "expression",
  // A prefix normally merges into its head noun; standalone it reads as noun.
  接頭詞: "noun",
  記号: "expression"
}

function classifyNoun(morpheme: RawMorpheme): LearnerPos {
  const [detail1] = morpheme.posDetail
  if (detail1 === "代名詞") return "pronoun"
  if (detail1 === "形容動詞語幹") return "adjective"
  // そう/よう/みたい are tagged as noun stems of auxiliaries; learners study
  // them as grammar (降りそうです), not as vocabulary nouns.
  if (morpheme.posDetail.includes("助動詞語幹")) return "auxiliary"
  return "noun"
}

export function classifyLearnerPos(morpheme: RawMorpheme): LearnerPos {
  if (morpheme.pos === "名詞") return classifyNoun(morpheme)
  return POS_TABLE[morpheme.pos] ?? "expression"
}

export function isPunctuationMorpheme(morpheme: RawMorpheme): boolean {
  if (PUNCTUATION_ONLY.test(morpheme.surface)) return true
  // IPADIC tags unknown CJK letters (e.g. 𠮷) as 記号,一般; those are words.
  return morpheme.pos === "記号" && !HAS_LETTER_OR_NUMBER.test(morpheme.surface)
}

export function isWhitespaceMorpheme(morpheme: RawMorpheme): boolean {
  return morpheme.surface.trim().length === 0
}
