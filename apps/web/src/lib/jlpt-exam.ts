/**
 * View-model for the JLPT exam-practice surface (`/japanese/practice/exam`).
 * Frontend-first: exam-style multiple choice questions are authored as mock
 * data today and can later be backed by
 * the seeded JLPT tables described in docs/research/japanese-nlp-jlpt.md.
 *
 * Levels (N5–N1) are an UNOFFICIAL study-grouping heuristic — JEES/Japan
 * Foundation publish no official lists (see the research doc §4). The UI
 * surfaces this disclaimer to users.
 */

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1"

/** 文字・語彙 (vocabulary) vs 文法 (grammar) — the two practiced sections. */
export type JlptSection = "vocabulary" | "grammar"

/**
 * Authentic JLPT question formats, all rendered as single-blank 4-choice MCQ:
 * - kanjiReading 漢字読み — read the bracketed kanji word
 * - context 文脈規定 — pick the word that fits the blank
 * - paraphrase 言い換え類義 — pick the closest meaning to the bracketed phrase
 * - grammarForm 文法形式の判断 — pick the grammar expression for the blank
 */
export type JlptQuestionType =
  | "kanjiReading"
  | "context"
  | "paraphrase"
  | "grammarForm"

export interface JlptChoice {
  id: string
  text: string
  /** Per-choice analysis shown after answering; starts with ✓ (correct) or ✗ (wrong). */
  note: string
}

/** 红宝书-style vocabulary gloss surfaced in the analysis panel. */
export interface JlptVocabularyGloss {
  term: string
  reading: string
  meaning: string
  partOfSpeech: string
}

/** 蓝宝书-style grammar gloss surfaced in the analysis panel. */
export interface JlptGrammarGloss {
  pattern: string
  reading: string
  meaning: string
  /** 接续 — how the pattern attaches to the preceding word. */
  connection: string
  explanation: string
}

export interface JlptQuestion {
  id: string
  level: JlptLevel
  section: JlptSection
  type: JlptQuestionType
  /**
   * Prompt sentence. context/grammarForm questions mark the answer blank with
   * ＿＿＿; kanjiReading/paraphrase wrap the focus word in 「」. A prompt carries
   * one marker style or the other, never both.
   */
  prompt: string
  /** Hiragana reading of the completed sentence; revealed only after answering. */
  promptReading: string | null
  choices: JlptChoice[]
  correctChoiceId: string
  /** Chinese translation of the completed sentence. */
  translation: string
  grammar: JlptGrammarGloss | null
  vocabulary: JlptVocabularyGloss[] | null
}

export const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"]
export const JLPT_SECTIONS: JlptSection[] = ["vocabulary", "grammar"]

export type JlptLevelFilter = "all" | JlptLevel
export type JlptSectionFilter = "all" | JlptSection

/** Badge palette per level, easiest (N5, green) → hardest (N1, rose). */
export const JLPT_LEVEL_BADGE_COLOR: Record<JlptLevel, string> = {
  N5: "border-emerald-400/30 bg-emerald-400/15 text-emerald-300",
  N4: "border-teal-400/30 bg-teal-400/15 text-teal-300",
  N3: "border-amber-400/30 bg-amber-400/15 text-amber-300",
  N2: "border-orange-400/30 bg-orange-400/15 text-orange-300",
  N1: "border-rose-400/30 bg-rose-400/15 text-rose-300"
}

export const filterJlptQuestions = (
  questions: JlptQuestion[],
  level: JlptLevelFilter,
  section: JlptSectionFilter
): JlptQuestion[] =>
  questions.filter(
    (question) =>
      (level === "all" || question.level === level) &&
      (section === "all" || question.section === section)
  )

export const getJlptChoiceById = (
  question: JlptQuestion,
  choiceId: string
): JlptChoice | undefined =>
  question.choices.find((choice) => choice.id === choiceId)

/** Hint key suffix per question type, used as `review.jlptExam.hint.<suffix>`. */
export const JLPT_TYPE_HINT_KEY: Record<JlptQuestionType, string> = {
  kanjiReading: "reading",
  context: "blank",
  paraphrase: "paraphrase",
  grammarForm: "blank"
}
