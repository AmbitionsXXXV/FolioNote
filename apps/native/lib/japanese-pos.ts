import type { LearnerPos } from "@folionote/japanese"

/** Same palette as the web reading view (JAPANESE_POS_SWATCH_COLOR_MAP). */
export const JAPANESE_POS_UNDERLINE_CLASS: Record<LearnerPos, string> = {
  noun: "bg-amber-400",
  pronoun: "bg-cyan-400",
  verb: "bg-emerald-400",
  adjective: "bg-pink-400",
  adverb: "bg-purple-400",
  particle: "bg-blue-400",
  auxiliary: "bg-slate-400",
  expression: "bg-orange-400"
}

export const ALL_JAPANESE_POS: LearnerPos[] = [
  "noun",
  "pronoun",
  "verb",
  "adjective",
  "adverb",
  "particle",
  "auxiliary",
  "expression"
]

/** Inflection tails (てみました) share one muted colour instead of a POS colour. */
export const JAPANESE_TAIL_UNDERLINE_CLASS = "bg-muted/40"

export const japanesePosLabelKey = (pos: LearnerPos) =>
  `review.japaneseTyping.posCategories.${pos}`
