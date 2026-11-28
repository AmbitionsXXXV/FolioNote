import type { AppRouterClient } from "@folionote/api/routers/index"
import type { TFunction } from "i18next"

type StudyApi = AppRouterClient["japanese"]["study"]

export type StudyDeck = Parameters<StudyApi["queue"]>[0]["deck"]
export type StudyCard = Awaited<ReturnType<StudyApi["queue"]>>["cards"][number]
export type StudyPlan = Awaited<ReturnType<StudyApi["plan"]>>
export type StudyDecks = Awaited<ReturnType<StudyApi["decks"]>>
export type StudyRating = Parameters<StudyApi["rate"]>[0]["rating"]
export type PosBook = NonNullable<Extract<StudyDeck, { kind: "level" }>["pos"]>
export type JlptLevel = Extract<StudyDeck, { kind: "level" }>["level"]

export const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"]
export const POS_BOOKS: PosBook[] = ["noun", "verb", "adjective", "adverb"]

/** Readers who never picked a book start with the easiest level. */
export const DEFAULT_DECK: StudyDeck = { kind: "level", level: "N5" }

/** A stable string for a deck: cache keys and route params. */
export const deckKey = (deck: StudyDeck): string => {
  if (deck.kind === "level") {
    return deck.pos ? `level:${deck.level}:${deck.pos}` : `level:${deck.level}`
  }
  return deck.kind === "moji"
    ? `moji:${deck.collectionId}`
    : `lexicon:${deck.id}`
}

export const parseDeckKey = (value: string | undefined): StudyDeck | null => {
  if (!value) return null
  const [kind, first, second] = value.split(":")
  if (kind === "level") {
    const level = JLPT_LEVELS.find((candidate) => candidate === first)
    if (!level) return null
    const pos = POS_BOOKS.find((candidate) => candidate === second)
    return pos ? { kind, level, pos } : { kind, level }
  }
  const id = value.slice(value.indexOf(":") + 1)
  if (kind === "moji" && id) return { kind, collectionId: id }
  if (kind === "lexicon" && id) return { kind, id }
  return null
}

export const sameDeck = (a: StudyDeck, b: StudyDeck) =>
  deckKey(a) === deckKey(b)

/** Short label such as "N4 · 动词", "生词本" or an imported list's name. */
export const deckLabel = (
  deck: StudyDeck,
  decks: StudyDecks | undefined,
  t: TFunction
): string => {
  if (deck.kind === "level") {
    return deck.pos
      ? `${deck.level} · ${t(`japanese.daily.pos.${deck.pos}`)}`
      : deck.level
  }
  if (deck.kind === "moji") {
    return (
      decks?.moji.find((list) => list.collectionId === deck.collectionId)
        ?.title ?? t("japanese.study.groups.moji")
    )
  }
  const lexicon = decks?.lexicons.find((list) => list.id === deck.id)
  if (lexicon?.kind === "notebook") return t("japanese.notebook.title")
  return lexicon?.name ?? t("japanese.study.groups.lexicons")
}

/** Cards due now in a deck, from the decks overview. */
export const deckDue = (deck: StudyDeck, decks: StudyDecks | undefined) => {
  if (!decks) return 0
  if (deck.kind === "level") {
    const level = decks.levels.find((row) => row.level === deck.level)
    if (!level) return 0
    if (!deck.pos) return level.due
    return level.books.find((book) => book.pos === deck.pos)?.due ?? 0
  }
  if (deck.kind === "moji") {
    return (
      decks.moji.find((list) => list.collectionId === deck.collectionId)?.due ??
      0
    )
  }
  return decks.lexicons.find((list) => list.id === deck.id)?.due ?? 0
}

/** The card's id as the API keys it. */
export const cardId = (card: StudyCard): string =>
  "vocabId" in card.key ? card.key.vocabId : `entry:${card.key.lexiconEntryId}`

/** Meanings in the reader's interface language first. */
export const cardMeanings = (card: StudyCard, language: string): string[] => {
  let order: (keyof StudyCard["meanings"])[] = ["zh", "ja", "en"]
  if (language.startsWith("en")) order = ["en", "zh", "ja"]
  else if (language.startsWith("ja")) order = ["ja", "zh", "en"]
  for (const key of order) {
    if (card.meanings[key].length > 0) return card.meanings[key]
  }
  return []
}
