export type JapanesePartOfSpeech =
  | "noun"
  | "pronoun"
  | "verb"
  | "adjective"
  | "adverb"
  | "particle"
  | "auxiliary"
  | "expression"

export const JAPANESE_POS_SWATCH_COLOR_MAP: Record<
  JapanesePartOfSpeech,
  string
> = {
  noun: "bg-amber-400",
  pronoun: "bg-cyan-400",
  verb: "bg-emerald-400",
  adjective: "bg-pink-400",
  adverb: "bg-purple-400",
  particle: "bg-blue-400",
  auxiliary: "bg-slate-400",
  expression: "bg-orange-400"
}

export const ALL_JAPANESE_POS_CATEGORIES: JapanesePartOfSpeech[] = [
  "noun",
  "pronoun",
  "verb",
  "adjective",
  "adverb",
  "particle",
  "auxiliary",
  "expression"
]
