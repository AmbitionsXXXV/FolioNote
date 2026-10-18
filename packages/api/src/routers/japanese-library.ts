import {
  db,
  jpArticles,
  jpLexiconEntries,
  jpLexicons,
  jpVocab
} from "@folionote/db"
import {
  DEFAULT_MAX_CHARS,
  splitArticle,
  decodeJapaneseBytes,
  htmlToJapaneseText
} from "@folionote/japanese"
import { createLogger } from "@folionote/log"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { protectedProcedure } from "../index"
import {
  analyzeArticle,
  articleWordStats,
  contentWords,
  prepareLexiconRows
} from "./japanese-library-helpers"
import type {
  ArticleAnalysis,
  PreparedLexiconEntry
} from "./japanese-library-helpers"
import { getJapaneseAnalyzer, getJapaneseUrlFetcher } from "./japanese-runtime"

const ARTICLE_MAX_CHARS = 20_000
const log = createLogger({ prefix: "japanese-library" })
const FIRST_LINE = /\r\n|\r|\n/
const IdInput = z.object({ id: z.string().min(1).max(128) })
const ArticleText = z
  .string()
  .min(1)
  .max(ARTICLE_MAX_CHARS)
  .refine((text) => text.trim().length > 0, "Text is empty")
const SourceType = z.enum(["paste", "url", "file"])
const LexiconRows = z
  .array(
    z.object({
      headword: z.string().trim().max(DEFAULT_MAX_CHARS),
      reading: z.string().trim().max(DEFAULT_MAX_CHARS).optional(),
      meanings: z.array(z.string().trim().max(4000)).max(100).optional(),
      pos: z.string().trim().max(200).optional(),
      unit: z.string().trim().max(200).optional()
    })
  )
  .max(5000)
const LexiconMetadata = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["book", "deck"]),
  level: z.enum(["N5", "N4", "N3", "N2", "N1"]).optional(),
  meaningLanguage: z.enum(["zh", "en", "ja"])
})

function requireAnalyzer() {
  const analyzer = getJapaneseAnalyzer()
  if (!analyzer)
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Japanese analyzer is not ready"
    })
  return analyzer
}

async function ownedArticle(id: string, userId: string) {
  const [article] = await db
    .select()
    .from(jpArticles)
    .where(and(eq(jpArticles.id, id), eq(jpArticles.userId, userId)))
    .limit(1)
  if (!article)
    throw new ORPCError("NOT_FOUND", { message: "Article not found" })
  return article
}

export async function ownedLexicon(id: string, userId: string) {
  const [lexicon] = await db
    .select()
    .from(jpLexicons)
    .where(and(eq(jpLexicons.id, id), eq(jpLexicons.userId, userId)))
    .limit(1)
  if (!lexicon)
    throw new ORPCError("NOT_FOUND", { message: "Lexicon not found" })
  return lexicon
}

function analysisFields(text: string, analysis: ArticleAnalysis | null) {
  const engine = analysis?.chunks[0]?.result.engine
  return {
    analysis,
    sentenceCount: splitArticle(text).sentences.length,
    wordCount: analysis ? contentWords(analysis).length : 0,
    engineId: engine?.id ?? null,
    dictVersion: engine?.dictVersion ?? null,
    analyzedAt: analysis ? new Date() : null
  }
}

async function persistAnalysis(
  article: typeof jpArticles.$inferSelect,
  onlyMissing = false
) {
  let analysis: ArticleAnalysis
  try {
    analysis = await analyzeArticle(article.text, requireAnalyzer())
  } catch (error) {
    if (!onlyMissing) throw error
    log.error("Lazy article analysis failed", error)
    return article
  }
  const [updated] = await db
    .update(jpArticles)
    .set(analysisFields(article.text, analysis))
    .where(
      and(
        eq(jpArticles.id, article.id),
        eq(jpArticles.userId, article.userId),
        onlyMissing ? isNull(jpArticles.analysis) : undefined
      )
    )
    .returning()
  // A concurrent lazy analysis may have won; a concurrent delete must stay deleted.
  return updated ?? (await ownedArticle(article.id, article.userId))
}

const fetchArticleUrl = protectedProcedure
  .input(z.object({ url: z.string().trim().min(1).max(4000) }))
  .handler(async ({ input }) => {
    const fetcher = getJapaneseUrlFetcher()
    if (!fetcher)
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Japanese URL fetcher is not ready"
      })
    try {
      const fetched = await fetcher(input.url)
      const decoded = decodeJapaneseBytes(fetched.bytes, fetched.contentType)
      const converted = /(?:text\/html|application\/xhtml\+xml)/i.test(
        fetched.contentType
      )
        ? htmlToJapaneseText(decoded)
        : { title: null, text: decoded }
      const title =
        converted.title ||
        converted.text.trim().split(FIRST_LINE)[0]?.trim() ||
        new URL(fetched.url).host
      return {
        title,
        text: converted.text.slice(0, ARTICLE_MAX_CHARS),
        truncated: converted.text.length > ARTICLE_MAX_CHARS
      }
    } catch (error) {
      throw new ORPCError("BAD_REQUEST", {
        message: error instanceof Error ? error.message : "Unable to fetch URL"
      })
    }
  })

const previewArticle = protectedProcedure
  .input(z.object({ text: ArticleText }))
  .handler(async ({ input, context }) => {
    const analysis = await analyzeArticle(input.text, requireAnalyzer())
    const words = contentWords(analysis)
    const forms = [...new Set(words.map((word) => word.baseForm))]
    const [vocab, known] = forms.length
      ? await Promise.all([
          db
            .select({
              word: jpVocab.word,
              otherForms: jpVocab.otherForms,
              level: jpVocab.level,
              reading: jpVocab.reading
            })
            .from(jpVocab)
            .where(
              or(
                inArray(jpVocab.word, forms),
                sql`${jpVocab.otherForms} ?| ARRAY[${sql.join(
                  forms.map((form) => sql`${form}`),
                  sql`, `
                )}]::text[]`
              )
            ),
          db
            .select({ baseForm: jpLexiconEntries.baseForm })
            .from(jpLexiconEntries)
            .innerJoin(
              jpLexicons,
              eq(jpLexicons.id, jpLexiconEntries.lexiconId)
            )
            .where(
              and(
                eq(jpLexicons.userId, context.session.user.id),
                inArray(jpLexiconEntries.baseForm, forms)
              )
            )
        ])
      : [[], []]
    const { newWords, ...stats } = articleWordStats(
      words,
      vocab,
      new Set(known.map((entry) => entry.baseForm))
    )
    const article = splitArticle(input.text)
    return {
      title: article.title,
      analysis,
      stats: { sentences: article.sentences.length, ...stats },
      newWords
    }
  })

const createArticle = protectedProcedure
  .input(
    z.object({
      title: z.string().trim().min(1).max(1000),
      text: ArticleText,
      sourceType: SourceType,
      sourceUrl: z.httpUrl().max(4000).optional()
    })
  )
  .handler(async ({ input, context }) => {
    const analyzer = getJapaneseAnalyzer()
    let analysis: ArticleAnalysis | null = null
    if (analyzer) {
      try {
        analysis = await analyzeArticle(input.text, analyzer)
      } catch (error) {
        log.error("Article analysis failed while saving", error)
      }
    }
    const [article] = await db
      .insert(jpArticles)
      .values({
        ...input,
        id: nanoid(),
        userId: context.session.user.id,
        ...analysisFields(input.text, analysis)
      })
      .returning()
    if (!article)
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Article was not saved"
      })
    return article
  })

export const japaneseArticlesRouter = {
  fetchUrl: fetchArticleUrl,
  preview: previewArticle,
  create: createArticle,
  list: protectedProcedure.handler(({ context }) =>
    db
      .select({
        id: jpArticles.id,
        title: jpArticles.title,
        sourceType: jpArticles.sourceType,
        sentenceCount: jpArticles.sentenceCount,
        wordCount: jpArticles.wordCount,
        createdAt: jpArticles.createdAt
      })
      .from(jpArticles)
      .where(eq(jpArticles.userId, context.session.user.id))
      .orderBy(desc(jpArticles.createdAt), desc(jpArticles.id))
  ),
  get: protectedProcedure.input(IdInput).handler(async ({ input, context }) => {
    const article = await ownedArticle(input.id, context.session.user.id)
    return article.analysis === null && getJapaneseAnalyzer()
      ? persistAnalysis(article, true)
      : article
  }),
  delete: protectedProcedure
    .input(IdInput)
    .handler(async ({ input, context }) => {
      const [deleted] = await db
        .delete(jpArticles)
        .where(
          and(
            eq(jpArticles.id, input.id),
            eq(jpArticles.userId, context.session.user.id)
          )
        )
        .returning({ id: jpArticles.id })
      if (!deleted)
        throw new ORPCError("NOT_FOUND", { message: "Article not found" })
      return deleted
    }),
  reanalyze: protectedProcedure
    .input(IdInput)
    .handler(async ({ input, context }) =>
      persistAnalysis(await ownedArticle(input.id, context.session.user.id))
    )
}

async function matchVocabulary(entries: PreparedLexiconEntry[]) {
  const forms = [
    ...new Set(entries.flatMap((entry) => [entry.headword, entry.baseForm]))
  ]
  if (!forms.length) return []
  // OpenJLPT files some words under their kana spelling with the kanji form in
  // other_forms (あいまい → 曖昧), so match both columns.
  const vocab = await db
    .select({
      id: jpVocab.id,
      word: jpVocab.word,
      reading: jpVocab.reading,
      otherForms: jpVocab.otherForms
    })
    .from(jpVocab)
    .where(
      or(
        inArray(jpVocab.word, forms),
        sql`${jpVocab.otherForms} ?| ARRAY[${sql.join(
          forms.map((form) => sql`${form}`),
          sql`, `
        )}]::text[]`
      )
    )
    .orderBy(asc(jpVocab.id))
  const byWord = new Map<string, typeof vocab>()
  for (const word of vocab) {
    for (const spelling of [word.word, ...word.otherForms]) {
      const matches = byWord.get(spelling) ?? []
      matches.push(word)
      byWord.set(spelling, matches)
    }
  }
  return entries.map((entry) => {
    const candidates = [
      ...(byWord.get(entry.headword) ?? []),
      ...(byWord.get(entry.baseForm) ?? [])
    ]
    const match = candidates.find(
      (word) => !entry.reading || word.reading === entry.reading
    )
    return { ...entry, vocabId: match?.id ?? null }
  })
}

function isNameConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "jp_lexicons_user_name_unique"
  )
    return true
  return (
    "cause" in error && error.cause !== error && isNameConflict(error.cause)
  )
}

const importLexicon = protectedProcedure
  .input(LexiconMetadata.extend({ rows: LexiconRows }))
  .handler(async ({ input, context }) => {
    const prepared = await prepareLexiconRows(input.rows, getJapaneseAnalyzer())
    const entries = await matchVocabulary(prepared.entries)
    const id = nanoid()
    try {
      await db.transaction(async (tx) => {
        await tx.insert(jpLexicons).values({
          id,
          userId: context.session.user.id,
          name: input.name,
          kind: input.kind,
          level: input.level,
          meaningLanguage: input.meaningLanguage,
          entryCount: entries.length
        })
        // Stay below PostgreSQL's parameter limit while retaining one atomic transaction.
        for (let start = 0; start < entries.length; start += 500) {
          await tx
            .insert(jpLexiconEntries)
            .values(
              entries
                .slice(start, start + 500)
                .map((entry) => ({ ...entry, lexiconId: id }))
            )
        }
      })
    } catch (error) {
      if (isNameConflict(error))
        throw new ORPCError("CONFLICT", {
          message: "A lexicon with this name already exists"
        })
      throw error
    }
    return { id, summary: prepared.summary }
  })

export const japaneseLexiconsRouter = {
  validate: protectedProcedure
    .input(LexiconMetadata.partial().extend({ rows: LexiconRows }))
    .handler(async ({ input }) => {
      const { summary, rows } = await prepareLexiconRows(
        input.rows,
        getJapaneseAnalyzer()
      )
      return { summary, rows }
    }),
  import: importLexicon,
  list: protectedProcedure.handler(({ context }) =>
    db
      .select()
      .from(jpLexicons)
      .where(eq(jpLexicons.userId, context.session.user.id))
      .orderBy(desc(jpLexicons.createdAt), desc(jpLexicons.id))
  ),
  get: protectedProcedure
    .input(
      IdInput.extend({
        unit: z.string().trim().max(200).optional(),
        cursor: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(200).default(50)
      })
    )
    .handler(async ({ input, context }) => {
      const lexicon = await ownedLexicon(input.id, context.session.user.id)
      const found = await db
        .select({ entry: jpLexiconEntries })
        .from(jpLexiconEntries)
        .innerJoin(jpLexicons, eq(jpLexicons.id, jpLexiconEntries.lexiconId))
        .where(
          and(
            eq(jpLexicons.userId, context.session.user.id),
            eq(jpLexiconEntries.lexiconId, input.id),
            input.unit === undefined
              ? undefined
              : eq(jpLexiconEntries.unit, input.unit),
            input.cursor === undefined
              ? undefined
              : gt(jpLexiconEntries.position, input.cursor)
          )
        )
        .orderBy(asc(jpLexiconEntries.position))
        .limit(input.limit + 1)
      const entries = found.slice(0, input.limit).map(({ entry }) => entry)
      return {
        lexicon,
        entries,
        nextCursor:
          found.length > input.limit ? (entries.at(-1)?.position ?? null) : null
      }
    }),
  delete: protectedProcedure
    .input(IdInput)
    .handler(async ({ input, context }) => {
      const [deleted] = await db
        .delete(jpLexicons)
        .where(
          and(
            eq(jpLexicons.id, input.id),
            eq(jpLexicons.userId, context.session.user.id)
          )
        )
        .returning({ id: jpLexicons.id })
      if (!deleted)
        throw new ORPCError("NOT_FOUND", { message: "Lexicon not found" })
      return deleted
    }),
  lookup: protectedProcedure
    .input(
      z.object({
        baseForms: z
          .array(z.string().trim().min(1).max(DEFAULT_MAX_CHARS))
          .max(500)
      })
    )
    .handler(({ input, context }) => {
      if (!input.baseForms.length) return []
      return db
        .select({
          baseForm: jpLexiconEntries.baseForm,
          lexiconId: jpLexicons.id,
          lexiconName: jpLexicons.name,
          unit: jpLexiconEntries.unit,
          meanings: jpLexiconEntries.meanings
        })
        .from(jpLexiconEntries)
        .innerJoin(jpLexicons, eq(jpLexicons.id, jpLexiconEntries.lexiconId))
        .where(
          and(
            eq(jpLexicons.userId, context.session.user.id),
            inArray(jpLexiconEntries.baseForm, input.baseForms)
          )
        )
        .orderBy(asc(jpLexicons.id), asc(jpLexiconEntries.position))
    })
}
