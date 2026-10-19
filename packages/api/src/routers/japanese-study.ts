import {
  db,
  jpLexiconEntries,
  jpLexicons,
  jpStudyState,
  jpVocab,
  jpVocabExamples
} from "@folionote/db"
import { ORPCError } from "@orpc/server"
import type { SQL } from "drizzle-orm"
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql
} from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure } from "../index"
import {
  calculateNextReview,
  createDefaultReviewState
} from "../utils/spaced-repetition"
import type { Rating } from "../utils/spaced-repetition"
import { ownedLexicon } from "./japanese-library"

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const
const DEFAULT_BATCH = 20

const DeckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("level"), level: z.enum(LEVELS) }),
  z.object({
    kind: z.literal("moji"),
    collectionId: z.string().trim().min(1).max(64)
  }),
  z.object({ kind: z.literal("lexicon"), id: z.string().min(1).max(128) })
])
export type StudyDeck = z.infer<typeof DeckSchema>

const CardKeySchema = z.union([
  z.object({ vocabId: z.string().min(1).max(64) }),
  z.object({ lexiconEntryId: z.number().int().positive() })
])

const RatingSchema = z.enum(["again", "hard", "good", "easy"])

// Keys are inlined (not bound) so GROUP BY sees the same expression as SELECT.
const mojiField = (
  field:
    | "collectionId"
    | "collectionTitle"
    | "page"
    | "position"
    | "partOfSpeech"
) => sql<string>`${jpVocab.sourceDetails}->'moji'->>${sql.raw(`'${field}'`)}`
const mojiCollectionId = mojiField("collectionId")

// Card rows join progress for the caller only. An imported entry the word bank
// matched shares its word's progress; an unmatched one keeps its own.
const vocabProgress = (userId: string) =>
  and(eq(jpStudyState.userId, userId), eq(jpStudyState.vocabId, jpVocab.id))
const entryProgress = (userId: string) =>
  and(
    eq(jpStudyState.userId, userId),
    or(
      and(
        isNotNull(jpLexiconEntries.vocabId),
        eq(jpStudyState.vocabId, jpLexiconEntries.vocabId)
      ),
      and(
        isNull(jpLexiconEntries.vocabId),
        eq(jpStudyState.lexiconEntryId, jpLexiconEntries.id)
      )
    )
  )

const progressCounts = (now: Date) => ({
  total: count(),
  studied: count(jpStudyState.id),
  due: sql<number>`count(*) filter (where ${jpStudyState.dueAt} <= ${now})::int`
})

const wordColumns = {
  vocabId: jpVocab.id,
  word: jpVocab.word,
  reading: jpVocab.reading,
  romaji: jpVocab.romaji,
  level: jpVocab.level,
  pitchAccents: jpVocab.pitchAccents,
  meaningsZh: jpVocab.meaningsZh,
  meaningsJa: jpVocab.meaningsJa,
  meaningsEn: jpVocab.meaningsEn,
  partOfSpeech: mojiField("partOfSpeech")
}
const vocabColumns = {
  ...wordColumns,
  dueAt: jpStudyState.dueAt,
  intervalDays: jpStudyState.intervalDays
}

interface VocabRow {
  vocabId: string
  word: string
  reading: string
  romaji: string
  level: string
  pitchAccents: number[]
  meaningsZh: string[] | null
  meaningsJa: string[] | null
  meaningsEn: string[]
  partOfSpeech: string | null
  dueAt: Date | null
  intervalDays: number | null
}

interface StudyCard {
  key: { vocabId: string } | { lexiconEntryId: number }
  word: string
  reading: string | null
  romaji: string | null
  level: string | null
  pitchAccents: number[]
  partOfSpeech: string | null
  meanings: { zh: string[]; ja: string[]; en: string[] }
  example: {
    ja: string
    furigana: string | null
    zh: string | null
    en: string | null
  } | null
  isNew: boolean
  intervalDays: number
}

function vocabCard(row: VocabRow): StudyCard {
  return {
    key: { vocabId: row.vocabId },
    word: row.word,
    reading: row.reading,
    romaji: row.romaji,
    level: row.level,
    pitchAccents: row.pitchAccents,
    partOfSpeech: row.partOfSpeech,
    meanings: {
      zh: row.meaningsZh ?? [],
      ja: row.meaningsJa ?? [],
      en: row.meaningsEn
    },
    example: null,
    isNew: row.dueAt === null,
    intervalDays: row.intervalDays ?? 0
  }
}

/** Due cards first (oldest due first), then unseen cards in deck order. */
async function vocabQueue(
  userId: string,
  filter: SQL | undefined,
  deckOrder: SQL[],
  limit: number,
  now: Date
) {
  const due = await db
    .select(vocabColumns)
    .from(jpVocab)
    .innerJoin(jpStudyState, vocabProgress(userId))
    .where(and(filter, lte(jpStudyState.dueAt, now)))
    .orderBy(asc(jpStudyState.dueAt))
    .limit(limit)
  const fresh =
    due.length < limit
      ? await db
          .select(vocabColumns)
          .from(jpVocab)
          .leftJoin(jpStudyState, vocabProgress(userId))
          .where(and(filter, isNull(jpStudyState.id)))
          .orderBy(...deckOrder)
          .limit(limit - due.length)
      : []
  return [...due, ...fresh].map(vocabCard)
}

async function lexiconQueue(
  userId: string,
  lexiconId: string,
  limit: number,
  now: Date
) {
  const lexicon = await ownedLexicon(lexiconId, userId)
  const base = () =>
    db
      .select({
        entryId: jpLexiconEntries.id,
        vocabId: jpLexiconEntries.vocabId,
        headword: jpLexiconEntries.headword,
        reading: jpLexiconEntries.reading,
        meanings: jpLexiconEntries.meanings,
        pos: jpLexiconEntries.pos,
        dueAt: jpStudyState.dueAt,
        intervalDays: jpStudyState.intervalDays
      })
      .from(jpLexiconEntries)
      .leftJoin(jpStudyState, entryProgress(userId))
  const inList = eq(jpLexiconEntries.lexiconId, lexicon.id)
  const due = await base()
    .where(
      and(inList, isNotNull(jpStudyState.id), lte(jpStudyState.dueAt, now))
    )
    .orderBy(asc(jpStudyState.dueAt))
    .limit(limit)
  const fresh =
    due.length < limit
      ? await base()
          .where(and(inList, isNull(jpStudyState.id)))
          .orderBy(asc(jpLexiconEntries.position))
          .limit(limit - due.length)
      : []
  const entries = [...due, ...fresh]

  const wordIds = entries.flatMap((entry) =>
    entry.vocabId === null ? [] : [entry.vocabId]
  )
  const words =
    wordIds.length > 0
      ? await db
          .select(wordColumns)
          .from(jpVocab)
          .where(inArray(jpVocab.id, wordIds))
      : []
  const wordById = new Map(words.map((word) => [word.vocabId, word]))
  const lang = lexicon.meaningLanguage

  return entries.map((entry): StudyCard => {
    const word =
      entry.vocabId === null ? undefined : wordById.get(entry.vocabId)
    if (!word) {
      const meanings = {
        zh: [] as string[],
        ja: [] as string[],
        en: [] as string[]
      }
      meanings[lang] = entry.meanings
      return {
        key: { lexiconEntryId: entry.entryId },
        word: entry.headword,
        reading: entry.reading,
        romaji: null,
        level: lexicon.level,
        pitchAccents: [],
        partOfSpeech: entry.pos,
        meanings,
        example: null,
        isNew: entry.dueAt === null,
        intervalDays: entry.intervalDays ?? 0
      }
    }
    const card = vocabCard({
      ...word,
      dueAt: entry.dueAt,
      intervalDays: entry.intervalDays
    })
    // The list's own wording fills a language the word bank lacks.
    if (card.meanings[lang].length === 0) card.meanings[lang] = entry.meanings
    card.partOfSpeech ??= entry.pos
    return card
  })
}

/** One example per word: the first with a Chinese line, else with English. */
async function attachExamples(cards: StudyCard[]) {
  const ids = cards.flatMap((card) =>
    "vocabId" in card.key ? [card.key.vocabId] : []
  )
  if (ids.length === 0) return cards
  const rows = await db
    .select({
      vocabId: jpVocabExamples.vocabId,
      ja: jpVocabExamples.ja,
      furigana: jpVocabExamples.furigana,
      zh: jpVocabExamples.zh,
      en: jpVocabExamples.en
    })
    .from(jpVocabExamples)
    .where(inArray(jpVocabExamples.vocabId, ids))
    .orderBy(asc(jpVocabExamples.vocabId), asc(jpVocabExamples.position))
  const rank = (row: (typeof rows)[number]) => {
    if (row.zh) return 0
    return row.en ? 1 : 2
  }
  const byWord = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    const current = byWord.get(row.vocabId)
    if (!current || rank(row) < rank(current)) byWord.set(row.vocabId, row)
  }
  for (const card of cards) {
    if (!("vocabId" in card.key)) continue
    const example = byWord.get(card.key.vocabId)
    if (example) {
      const { vocabId: _vocabId, ...sentence } = example
      card.example = sentence
    }
  }
  return cards
}

/**
 * japanese.study.decks - Every deck the caller can study, with progress:
 * built-in JLPT levels, MOJi word lists in the word bank, and imported lists.
 */
const listDecks = protectedProcedure.handler(async ({ context }) => {
  const userId = context.session.user.id
  const now = new Date()
  const [levels, moji, lexicons] = await Promise.all([
    db
      .select({ level: jpVocab.level, ...progressCounts(now) })
      .from(jpVocab)
      .leftJoin(jpStudyState, vocabProgress(userId))
      .groupBy(jpVocab.level),
    db
      .select({
        collectionId: mojiCollectionId,
        title: sql<string>`max(${mojiField("collectionTitle")})`,
        ...progressCounts(now)
      })
      .from(jpVocab)
      .leftJoin(jpStudyState, vocabProgress(userId))
      .where(isNotNull(mojiCollectionId))
      .groupBy(mojiCollectionId)
      .orderBy(asc(sql`max(${mojiField("collectionTitle")})`)),
    db
      .select({
        id: jpLexicons.id,
        name: jpLexicons.name,
        level: jpLexicons.level,
        ...progressCounts(now)
      })
      .from(jpLexicons)
      .innerJoin(
        jpLexiconEntries,
        eq(jpLexiconEntries.lexiconId, jpLexicons.id)
      )
      .leftJoin(jpStudyState, entryProgress(userId))
      .where(eq(jpLexicons.userId, userId))
      .groupBy(jpLexicons.id)
      .orderBy(asc(jpLexicons.name))
  ])

  return {
    levels: LEVELS.map((level) => {
      const row = levels.find((found) => found.level === level)
      return {
        level,
        total: row?.total ?? 0,
        studied: row?.studied ?? 0,
        due: row?.due ?? 0
      }
    }),
    moji,
    lexicons
  }
})

/**
 * japanese.study.queue - The next batch for a deck: due cards, then new ones.
 */
const studyQueue = protectedProcedure
  .input(
    z.object({
      deck: DeckSchema,
      limit: z.number().int().min(1).max(50).default(DEFAULT_BATCH)
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const now = new Date()
    const { deck, limit } = input
    let cards: StudyCard[]
    if (deck.kind === "level") {
      cards = await vocabQueue(
        userId,
        eq(jpVocab.level, deck.level),
        [asc(jpVocab.id)],
        limit,
        now
      )
    } else if (deck.kind === "moji") {
      cards = await vocabQueue(
        userId,
        eq(mojiCollectionId, deck.collectionId),
        [
          asc(sql`(${mojiField("page")})::int`),
          asc(sql`(${mojiField("position")})::int`)
        ],
        limit,
        now
      )
    } else {
      cards = await lexiconQueue(userId, deck.id, limit, now)
    }
    return { cards: await attachExamples(cards) }
  })

/**
 * japanese.study.rate - Record how well the caller knew a card and schedule
 * its next review.
 */
const rateCard = protectedProcedure
  .input(z.object({ key: CardKeySchema, rating: RatingSchema }))
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const now = new Date()
    let target: SQL | undefined
    let values: { vocabId: string } | { lexiconEntryId: number }

    if ("vocabId" in input.key) {
      const [word] = await db
        .select({ id: jpVocab.id })
        .from(jpVocab)
        .where(eq(jpVocab.id, input.key.vocabId))
        .limit(1)
      if (!word) throw new ORPCError("NOT_FOUND", { message: "Word not found" })
      values = { vocabId: word.id }
      target = eq(jpStudyState.vocabId, word.id)
    } else {
      const [entry] = await db
        .select({ id: jpLexiconEntries.id, vocabId: jpLexiconEntries.vocabId })
        .from(jpLexiconEntries)
        .innerJoin(jpLexicons, eq(jpLexicons.id, jpLexiconEntries.lexiconId))
        .where(
          and(
            eq(jpLexiconEntries.id, input.key.lexiconEntryId),
            eq(jpLexicons.userId, userId)
          )
        )
        .limit(1)
      if (!entry)
        throw new ORPCError("NOT_FOUND", { message: "List entry not found" })
      // Matched entries study as their word so progress is shared across decks.
      if (entry.vocabId !== null)
        throw new ORPCError("BAD_REQUEST", {
          message: "Rate this entry by its word id"
        })
      values = { lexiconEntryId: entry.id }
      target = eq(jpStudyState.lexiconEntryId, entry.id)
    }

    const [previous] = await db
      .select()
      .from(jpStudyState)
      .where(and(eq(jpStudyState.userId, userId), target))
      .limit(1)
    const next = calculateNextReview(
      previous ?? createDefaultReviewState(now),
      input.rating as Rating,
      now
    )
    const [saved] = await db
      .insert(jpStudyState)
      .values({ userId, ...values, ...next })
      .onConflictDoUpdate({
        target:
          "vocabId" in values
            ? [jpStudyState.userId, jpStudyState.vocabId]
            : [jpStudyState.userId, jpStudyState.lexiconEntryId],
        set: { ...next, updatedAt: now }
      })
      .returning({
        dueAt: jpStudyState.dueAt,
        intervalDays: jpStudyState.intervalDays
      })
    return saved
  })

export const japaneseStudyRouter = {
  decks: listDecks,
  queue: studyQueue,
  rate: rateCard
}
