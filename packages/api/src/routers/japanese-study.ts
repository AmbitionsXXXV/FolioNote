import {
  db,
  jpLexiconEntries,
  jpLexicons,
  jpStudyPlans,
  jpStudyState,
  jpVocab,
  jpVocabExamples,
  learningActivities
} from "@folionote/db"
import { getJpAudioUrl } from "@folionote/storage"
import { ORPCError } from "@orpc/server"
import type { SQL } from "drizzle-orm"
import {
  and,
  asc,
  count,
  desc,
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
  loadStreakSettings,
  recordLearningActivity,
  resolveTimeZone
} from "../utils/learning-activity"
import {
  calculateNextReview,
  createDefaultReviewState
} from "../utils/spaced-repetition"
import type { Rating } from "../utils/spaced-repetition"
import { getLocalDate } from "../utils/streak"
import {
  DAILY_NEW_WORDS_MAX,
  DAILY_NEW_WORDS_MIN,
  DAILY_REVIEW_LIMIT_OPTIONS,
  DEFAULT_DAILY_NEW_WORDS,
  planToday,
  replayTime
} from "../utils/study-plan"
import { TimeZoneSchema } from "../utils/time-zone-schema"
import { ownedLexicon } from "./japanese-library"

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const
const DEFAULT_BATCH = 20

/** Built-in word books split each JLPT level by part of speech. */
const POS_BOOKS = ["noun", "verb", "adjective", "adverb"] as const
type PosBook = (typeof POS_BOOKS)[number]
const POS_CODES: Record<PosBook, string[]> = {
  noun: ["n", "n-adv", "n-t", "pn", "num", "ctr"],
  verb: ["v1", "vk", "vs-i", "vs-s", "vz"],
  adjective: ["adj-i", "adj-na", "adj-no", "adj-ix"],
  adverb: ["adv", "adv-to"]
}

/**
 * Words tagged with any of the book's JMdict codes. A word with several parts
 * of speech belongs to several books and shares its progress between them.
 */
const posFilter = (pos: PosBook): SQL => {
  const codes = sql`array[${sql.join(
    POS_CODES[pos].map((code) => sql`${code}`),
    sql`, `
  )}]::text[]`
  const tagged = sql`${jpVocab.jmdictPos} ?| ${codes}`
  if (pos !== "verb") return tagged
  // Godan verbs carry one code per ending (v5k, v5r, v5k-s…).
  return sql`(${tagged} or exists (select 1 from jsonb_array_elements_text(${jpVocab.jmdictPos}) as pos_code where pos_code like 'v5%'))`
}

const DeckSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("level"),
    level: z.enum(LEVELS),
    pos: z.enum(POS_BOOKS).optional()
  }),
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

type BookColumns = Record<
  `${PosBook}${"Total" | "Studied" | "Due"}`,
  SQL<number>
>

/** Total / studied / due counts for every part-of-speech book, as columns. */
const bookColumns = (now: Date): BookColumns =>
  Object.fromEntries(
    POS_BOOKS.flatMap((pos) => {
      const inBook = posFilter(pos)
      return [
        [`${pos}Total`, sql<number>`count(*) filter (where ${inBook})::int`],
        [
          `${pos}Studied`,
          sql<number>`count(${jpStudyState.id}) filter (where ${inBook})::int`
        ],
        [
          `${pos}Due`,
          sql<number>`count(*) filter (where ${inBook} and ${jpStudyState.dueAt} <= ${now})::int`
        ]
      ]
    })
  ) as BookColumns

const audioUrl = (path: string | null): string | null =>
  path === null ? null : getJpAudioUrl(path)

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
  partOfSpeech: mojiField("partOfSpeech"),
  audioPath: jpVocab.audioPath
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
  audioPath: string | null
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
    /** "context": the sentence the reader saved the word from. */
    source: "context" | "bank"
  } | null
  /** Pre-generated pronunciations; null falls back to the device voice. */
  audio: { word: string | null; example: string | null }
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
    audio: { word: audioUrl(row.audioPath), example: null },
    isNew: row.dueAt === null,
    intervalDays: row.intervalDays ?? 0
  }
}

interface QueueLimits {
  /** Cards in the batch. */
  limit: number
  /** Unseen cards allowed in the batch; undefined fills the batch. */
  newLimit?: number
}

const freshCount = ({ limit, newLimit }: QueueLimits, dueCount: number) =>
  Math.max(0, Math.min(limit - dueCount, newLimit ?? limit))

/** Due cards first (oldest due first), then unseen cards in deck order. */
async function vocabQueue(
  userId: string,
  filter: SQL | undefined,
  deckOrder: SQL[],
  limits: QueueLimits,
  now: Date
) {
  const { limit } = limits
  const due = await db
    .select(vocabColumns)
    .from(jpVocab)
    .innerJoin(jpStudyState, vocabProgress(userId))
    .where(and(filter, lte(jpStudyState.dueAt, now)))
    .orderBy(asc(jpStudyState.dueAt))
    .limit(limit)
  const freshLimit = freshCount(limits, due.length)
  const fresh =
    freshLimit > 0
      ? await db
          .select(vocabColumns)
          .from(jpVocab)
          .leftJoin(jpStudyState, vocabProgress(userId))
          .where(and(filter, isNull(jpStudyState.id)))
          .orderBy(...deckOrder)
          .limit(freshLimit)
      : []
  return [...due, ...fresh].map(vocabCard)
}

async function lexiconQueue(
  userId: string,
  lexiconId: string,
  limits: QueueLimits,
  now: Date
) {
  const { limit } = limits
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
        contextSentence: jpLexiconEntries.contextSentence,
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
  const freshLimit = freshCount(limits, due.length)
  const fresh =
    freshLimit > 0
      ? await base()
          .where(and(inList, isNull(jpStudyState.id)))
          .orderBy(asc(jpLexiconEntries.position))
          .limit(freshLimit)
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

  const contextExample = (sentence: string | null): StudyCard["example"] =>
    sentence === null
      ? null
      : { ja: sentence, furigana: null, zh: null, en: null, source: "context" }

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
        example: contextExample(entry.contextSentence),
        audio: { word: null, example: null },
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
    // The sentence the reader met the word in beats a dictionary example.
    card.example = contextExample(entry.contextSentence)
    return card
  })
}

/**
 * One example per word: the first with a Chinese line, else with English.
 * Cards that already carry the reader's own context sentence keep it.
 */
async function attachExamples(cards: StudyCard[]) {
  const ids = cards.flatMap((card) =>
    "vocabId" in card.key && card.example === null ? [card.key.vocabId] : []
  )
  if (ids.length === 0) return cards
  const rows = await db
    .select({
      vocabId: jpVocabExamples.vocabId,
      ja: jpVocabExamples.ja,
      furigana: jpVocabExamples.furigana,
      zh: jpVocabExamples.zh,
      en: jpVocabExamples.en,
      audioPath: jpVocabExamples.audioPath
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
    if (!("vocabId" in card.key) || card.example !== null) continue
    const example = byWord.get(card.key.vocabId)
    if (example) {
      const { vocabId: _vocabId, audioPath, ...sentence } = example
      card.example = { ...sentence, source: "bank" }
      card.audio.example = audioUrl(audioPath)
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
      .select({
        level: jpVocab.level,
        ...progressCounts(now),
        ...bookColumns(now)
      })
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
        kind: jpLexicons.kind,
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
      // The reader's own notebook leads; imported lists follow by name.
      .orderBy(desc(sql`${jpLexicons.kind} = 'notebook'`), asc(jpLexicons.name))
  ])

  return {
    levels: LEVELS.map((level) => {
      const row = levels.find((found) => found.level === level)
      const num = (key: keyof BookColumns | "total" | "studied" | "due") =>
        Number(row?.[key] ?? 0)
      return {
        level,
        total: num("total"),
        studied: num("studied"),
        due: num("due"),
        books: POS_BOOKS.map((pos) => ({
          pos,
          total: num(`${pos}Total` as const),
          studied: num(`${pos}Studied` as const),
          due: num(`${pos}Due` as const)
        }))
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
      limit: z.number().int().min(1).max(50).default(DEFAULT_BATCH),
      /** Cap on unseen cards, so the daily new-word target is respected. */
      newLimit: z.number().int().min(0).max(50).optional()
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const now = new Date()
    const { deck } = input
    const limits = { limit: input.limit, newLimit: input.newLimit }
    let cards: StudyCard[]
    if (deck.kind === "level") {
      cards = await vocabQueue(
        userId,
        and(
          eq(jpVocab.level, deck.level),
          deck.pos ? posFilter(deck.pos) : undefined
        ),
        [asc(jpVocab.id)],
        limits,
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
        limits,
        now
      )
    } else {
      cards = await lexiconQueue(userId, deck.id, limits, now)
    }
    return { cards: await attachExamples(cards) }
  })

/**
 * japanese.study.rate - Record how well the caller knew a card and schedule
 * its next review.
 */
const rateCard = protectedProcedure
  .input(
    z.object({
      key: CardKeySchema,
      rating: RatingSchema,
      timeZone: TimeZoneSchema,
      /** Client-made id for an offline rating, so a replay is applied once. */
      clientId: z
        .string()
        .regex(/^[\w-]{8,64}$/)
        .optional(),
      /** When the reader rated the card offline. */
      occurredAt: z.date().optional()
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const now = replayTime(input.occurredAt, new Date())
    // Prefixed with the user so one reader's ids can never collide with another's.
    const activityId =
      input.clientId === undefined
        ? undefined
        : `jp-rate:${userId}:${input.clientId}`
    let target: SQL | undefined
    let values: { vocabId: string } | { lexiconEntryId: number }
    let term: string | undefined

    if ("vocabId" in input.key) {
      const [word] = await db
        .select({ id: jpVocab.id, word: jpVocab.word })
        .from(jpVocab)
        .where(eq(jpVocab.id, input.key.vocabId))
        .limit(1)
      if (!word) throw new ORPCError("NOT_FOUND", { message: "Word not found" })
      values = { vocabId: word.id }
      term = word.word
      target = eq(jpStudyState.vocabId, word.id)
    } else {
      const [entry] = await db
        .select({
          id: jpLexiconEntries.id,
          vocabId: jpLexiconEntries.vocabId,
          headword: jpLexiconEntries.headword
        })
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
      term = entry.headword
      target = eq(jpStudyState.lexiconEntryId, entry.id)
    }

    if (activityId !== undefined) {
      const [seen] = await db
        .select({ id: learningActivities.id })
        .from(learningActivities)
        .where(eq(learningActivities.id, activityId))
        .limit(1)
      if (seen) {
        const [state] = await db
          .select({
            dueAt: jpStudyState.dueAt,
            intervalDays: jpStudyState.intervalDays
          })
          .from(jpStudyState)
          .where(and(eq(jpStudyState.userId, userId), target))
          .limit(1)
        return state ? { ...state, progress: null } : undefined
      }
    }

    const [previous] = await db
      .select()
      .from(jpStudyState)
      .where(and(eq(jpStudyState.userId, userId), target))
      .limit(1)
    // A late offline replay never schedules from before a newer review.
    const reviewedAt =
      previous?.lastReviewedAt && previous.lastReviewedAt > now
        ? previous.lastReviewedAt
        : now
    const next = calculateNextReview(
      previous ?? createDefaultReviewState(reviewedAt),
      input.rating as Rating,
      reviewedAt
    )
    const [saved] = await db
      .insert(jpStudyState)
      .values({ userId, ...values, ...next })
      .onConflictDoUpdate({
        target:
          "vocabId" in values
            ? [jpStudyState.userId, jpStudyState.vocabId]
            : [jpStudyState.userId, jpStudyState.lexiconEntryId],
        set: { ...next, updatedAt: new Date() }
      })
      .returning({
        dueAt: jpStudyState.dueAt,
        intervalDays: jpStudyState.intervalDays
      })
    // A card seen for the first time counts as learning a new word.
    const progress = await recordLearningActivity(db, {
      id: activityId,
      userId,
      kind: previous ? "vocab_review" : "vocab_new",
      refId:
        "vocabId" in values ? values.vocabId : String(values.lexiconEntryId),
      language: "ja",
      meta: { rating: input.rating, term },
      occurredAt: now,
      timeZone: input.timeZone
    })
    return saved ? { ...saved, progress } : saved
  })

const parseDeck = (value: string | null): StudyDeck | null => {
  if (value === null) return null
  try {
    const parsed = DeckSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    // A deck saved by an older client in another shape is simply forgotten.
    return null
  }
}

/**
 * japanese.study.plan - The caller's daily plan and how far today has got:
 * new words and reviews done, and what is left of each.
 */
const getPlan = protectedProcedure
  .input(z.object({ timeZone: TimeZoneSchema }).optional())
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const now = new Date()
    const settings = await loadStreakSettings(db, userId)
    const timeZone = resolveTimeZone(settings, input?.timeZone)
    const localDate = getLocalDate(now, timeZone, settings.dayStartHour)
    const [[plan], done, [due]] = await Promise.all([
      db
        .select()
        .from(jpStudyPlans)
        .where(eq(jpStudyPlans.userId, userId))
        .limit(1),
      db
        .select({ kind: learningActivities.kind, count: count() })
        .from(learningActivities)
        .where(
          and(
            eq(learningActivities.userId, userId),
            eq(learningActivities.localDate, localDate),
            inArray(learningActivities.kind, ["vocab_new", "vocab_review"])
          )
        )
        .groupBy(learningActivities.kind),
      db
        .select({ count: count() })
        .from(jpStudyState)
        .where(
          and(eq(jpStudyState.userId, userId), lte(jpStudyState.dueAt, now))
        )
    ])
    const doneOf = (kind: string) =>
      done.find((row) => row.kind === kind)?.count ?? 0
    const dailyNewWords = plan?.dailyNewWords ?? DEFAULT_DAILY_NEW_WORDS
    const dailyReviewLimit = plan?.dailyReviewLimit ?? null
    const newDone = doneOf("vocab_new")
    const reviewDone = doneOf("vocab_review")
    const dueNow = due?.count ?? 0
    return {
      dailyNewWords,
      dailyReviewLimit,
      deck: parseDeck(plan?.deck ?? null),
      today: {
        localDate,
        newDone,
        reviewDone,
        dueNow,
        ...planToday({
          dailyNewWords,
          dailyReviewLimit,
          newDone,
          reviewDone,
          dueNow
        })
      }
    }
  })

const optionOf = (options: readonly number[], message: string) =>
  z
    .number()
    .int()
    .refine((value) => (options as readonly number[]).includes(value), {
      message
    })

/**
 * japanese.study.updatePlan - Change the daily plan; omitted fields stay.
 */
const updatePlan = protectedProcedure
  .input(
    z.object({
      dailyNewWords: z
        .number()
        .int()
        .min(DAILY_NEW_WORDS_MIN)
        .max(DAILY_NEW_WORDS_MAX)
        .optional(),
      dailyReviewLimit: optionOf(
        DAILY_REVIEW_LIMIT_OPTIONS,
        "Unsupported review limit"
      )
        .nullable()
        .optional(),
      deck: DeckSchema.nullable().optional()
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const changes = {
      ...(input.dailyNewWords === undefined
        ? {}
        : { dailyNewWords: input.dailyNewWords }),
      ...(input.dailyReviewLimit === undefined
        ? {}
        : { dailyReviewLimit: input.dailyReviewLimit }),
      ...(input.deck === undefined
        ? {}
        : { deck: input.deck === null ? null : JSON.stringify(input.deck) })
    }
    const [saved] = await db
      .insert(jpStudyPlans)
      .values({ userId, ...changes })
      .onConflictDoUpdate({
        target: jpStudyPlans.userId,
        set: { ...changes, updatedAt: new Date() }
      })
      .returning()
    return {
      dailyNewWords: saved?.dailyNewWords ?? DEFAULT_DAILY_NEW_WORDS,
      dailyReviewLimit: saved?.dailyReviewLimit ?? null,
      deck: parseDeck(saved?.deck ?? null)
    }
  })

export const japaneseStudyRouter = {
  decks: listDecks,
  queue: studyQueue,
  rate: rateCard,
  plan: getPlan,
  updatePlan
}
