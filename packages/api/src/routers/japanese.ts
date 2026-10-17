import { db, jpGrammar, jpKanji, jpVocab, jpVocabExamples } from "@folionote/db"
import { DEFAULT_MAX_CHARS } from "@folionote/japanese"
import { ORPCError } from "@orpc/server"
import { asc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure } from "../index"
import {
  japaneseArticlesRouter,
  japaneseLexiconsRouter
} from "./japanese-library"
import { analyzeJapaneseText } from "./japanese-runtime"

export { setJapaneseAnalyzer, setJapaneseUrlFetcher } from "./japanese-runtime"

const LIKE_SPECIAL_CHARS = /[\\%_]/g
const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g
const KANJI_CHAR = /[㐀-䶿一-鿿豈-﫿々]/u
const LATIN_QUERY = /^[\s\w'-]+$/
const LEADING_WAVE_DASH = /^[〜~～]+/

const escapeLike = (value: string) =>
  value.replace(LIKE_SPECIAL_CHARS, (char) => `\\${char}`)

const SearchInputSchema = z.object({
  query: z.string().trim().min(1).max(64),
  limit: z.number().int().min(1).max(50).default(20)
})

const WordInputSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{10}$/)
})

// Same limit the analyzer enforces, so the published schema never accepts
// text the analyzer will then reject.
const AnalyzeInputSchema = z.object({
  text: z.string().max(DEFAULT_MAX_CHARS)
})

/**
 * japanese.search - Words, kanji and grammar from the built-in word bank.
 * Kana, kanji and romaji match by prefix; English matches inside meanings.
 */
export const searchJapanese = protectedProcedure
  .input(SearchInputSchema)
  .handler(async ({ input }) => {
    const query = input.query
    const prefix = `${escapeLike(query)}%`
    const contains = `%${escapeLike(query)}%`
    const isLatin = LATIN_QUERY.test(query)

    const lowered = query.toLowerCase()
    // Whole-word match so "eat" doesn't find "meat" or "weather".
    const meaningWord = `\\m${lowered.replace(REGEX_SPECIAL_CHARS, "\\$&")}\\M`
    const exactMeanings = JSON.stringify([lowered])
    const exactToMeanings = JSON.stringify([`to ${lowered}`])

    // Lower rank = better: exact headword/reading/romaji, then prefix, then an
    // exact English meaning, then other spellings, then any meaning match.
    const rank = sql<number>`case
      when ${jpVocab.word} = ${query} or ${jpVocab.reading} = ${query} or ${jpVocab.romaji} = ${lowered} then 0
      when ${jpVocab.word} like ${prefix} or ${jpVocab.reading} like ${prefix} or ${jpVocab.romaji} like ${prefix.toLowerCase()} then 1
      when ${jpVocab.meaningsEn} @> ${exactMeanings}::jsonb or ${jpVocab.meaningsEn} @> ${exactToMeanings}::jsonb then 2
      when ${jpVocab.otherForms}::text like ${contains} or ${jpVocab.otherReadings}::text like ${contains} then 3
      else 4 end`

    const wordConditions = [
      ilike(jpVocab.word, prefix),
      ilike(jpVocab.reading, prefix),
      ilike(jpVocab.romaji, prefix),
      sql`${jpVocab.otherForms}::text like ${contains}`,
      sql`${jpVocab.otherReadings}::text like ${contains}`
    ]
    if (isLatin) {
      wordConditions.push(sql`${jpVocab.meaningsEn}::text ~* ${meaningWord}`)
    }

    const kanjiChars = [
      ...new Set([...query].filter((c) => KANJI_CHAR.test(c)))
    ]

    // Grammar patterns are written "〜てみる"; compare without the wave dash.
    const bareQuery = query.replace(LEADING_WAVE_DASH, "")
    const barePattern = sql`regexp_replace(${jpGrammar.pattern}, '^〜', '')`
    const grammarRank = sql<number>`case
      when ${barePattern} = ${bareQuery} or ${jpGrammar.romaji} = ${lowered} then 0
      when ${barePattern} like ${`${escapeLike(bareQuery)}%`} or ${jpGrammar.romaji} like ${prefix.toLowerCase()} then 1
      when ${jpGrammar.pattern} like ${`%${escapeLike(bareQuery)}%`} or ${jpGrammar.reading} like ${`%${escapeLike(bareQuery)}%`} then 2
      else 3 end`

    const [words, kanji, grammar] = await Promise.all([
      db
        .select({
          id: jpVocab.id,
          word: jpVocab.word,
          reading: jpVocab.reading,
          romaji: jpVocab.romaji,
          level: jpVocab.level,
          meaningsEn: jpVocab.meaningsEn,
          meaningsZh: jpVocab.meaningsZh
        })
        .from(jpVocab)
        .where(or(...wordConditions))
        .orderBy(
          rank,
          sql`${jpVocab.level} desc`,
          sql`char_length(${jpVocab.reading})`,
          jpVocab.id
        )
        .limit(input.limit),
      kanjiChars.length > 0
        ? db
            .select({
              character: jpKanji.character,
              level: jpKanji.level,
              strokes: jpKanji.strokes,
              meaningsEn: jpKanji.meaningsEn
            })
            .from(jpKanji)
            .where(inArray(jpKanji.character, kanjiChars))
        : Promise.resolve([]),
      db
        .select({
          id: jpGrammar.id,
          pattern: jpGrammar.pattern,
          level: jpGrammar.level,
          meaning: jpGrammar.meaning,
          formation: jpGrammar.formation
        })
        .from(jpGrammar)
        .where(
          or(
            ilike(jpGrammar.pattern, `%${escapeLike(bareQuery)}%`),
            ilike(jpGrammar.reading, `%${escapeLike(bareQuery)}%`),
            ilike(jpGrammar.romaji, prefix),
            isLatin ? sql`${jpGrammar.meaning} ~* ${meaningWord}` : undefined
          )
        )
        .orderBy(
          grammarRank,
          sql`${jpGrammar.level} desc`,
          sql`char_length(${jpGrammar.pattern})`,
          jpGrammar.id
        )
        .limit(5)
    ])

    return { words, kanji, grammar }
  })

/**
 * japanese.word - One word with its examples and the kanji it is written with.
 */
export const getJapaneseWord = protectedProcedure
  .input(WordInputSchema)
  .handler(async ({ input }) => {
    const [word] = await db
      .select()
      .from(jpVocab)
      .where(eq(jpVocab.id, input.id))
      .limit(1)

    if (!word) {
      throw new ORPCError("NOT_FOUND", { message: "Word not found" })
    }

    const kanjiChars = [
      ...new Set([...word.word].filter((c) => KANJI_CHAR.test(c)))
    ]

    const [examples, kanji] = await Promise.all([
      db
        .select({
          ja: jpVocabExamples.ja,
          furigana: jpVocabExamples.furigana,
          en: jpVocabExamples.en,
          tatoebaId: jpVocabExamples.tatoebaId
        })
        .from(jpVocabExamples)
        .where(eq(jpVocabExamples.vocabId, word.id))
        .orderBy(asc(jpVocabExamples.position)),
      kanjiChars.length > 0
        ? db
            .select()
            .from(jpKanji)
            .where(inArray(jpKanji.character, kanjiChars))
        : Promise.resolve([])
    ])

    // Keep kanji in the order they appear in the word.
    kanji.sort(
      (a, b) =>
        kanjiChars.indexOf(a.character) - kanjiChars.indexOf(b.character)
    )

    return { word, examples, kanji }
  })

/**
 * japanese.levels - Word, kanji and grammar counts per JLPT level.
 */
export const getJapaneseLevels = protectedProcedure.handler(async () => {
  const count = sql<number>`count(*)::int`
  const [vocab, kanji, grammar] = await Promise.all([
    db
      .select({ level: jpVocab.level, count })
      .from(jpVocab)
      .groupBy(jpVocab.level),
    db
      .select({ level: jpKanji.level, count })
      .from(jpKanji)
      .groupBy(jpKanji.level),
    db
      .select({ level: jpGrammar.level, count })
      .from(jpGrammar)
      .groupBy(jpGrammar.level)
  ])

  const levels = ["N5", "N4", "N3", "N2", "N1"] as const
  const find = (rows: { level: string; count: number }[], level: string) =>
    rows.find((row) => row.level === level)?.count ?? 0

  return levels.map((level) => ({
    level,
    words: find(vocab, level),
    kanji: find(kanji, level),
    grammar: find(grammar, level)
  }))
})

/**
 * japanese.analyze - Segment text into morphemes, learner words and phrases.
 */
export const analyzeJapanese = protectedProcedure
  .input(AnalyzeInputSchema)
  .handler(({ input }) => analyzeJapaneseText(input.text))

export const japaneseRouter = {
  articles: japaneseArticlesRouter,
  lexicons: japaneseLexiconsRouter,
  search: searchJapanese,
  word: getJapaneseWord,
  levels: getJapaneseLevels,
  analyze: analyzeJapanese
}
