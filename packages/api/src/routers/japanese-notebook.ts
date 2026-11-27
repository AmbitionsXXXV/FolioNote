import { db, jpArticles, jpLexiconEntries, jpLexicons, jpVocab } from "@folionote/db"
import { DEFAULT_MAX_CHARS } from "@folionote/japanese"
import { ORPCError } from "@orpc/server"
import { and, eq, inArray, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { protectedProcedure } from "../index"
import { matchVocabulary } from "./japanese-library"

/** Stored but never displayed: clients show their own localized title. */
export const NOTEBOOK_NAME = "notebook"
const CONTEXT_MAX_CHARS = 1000

const MeaningLanguage = z.enum(["zh", "en", "ja"])

const SaveInput = z.union([
  // A word from the built-in word bank (search results, word page, study card).
  z.object({
    vocabId: z.string().min(1).max(64),
    meaningLanguage: MeaningLanguage
  }),
  // A word tapped in analyzed text; matched to the word bank when possible.
  z.object({
    headword: z.string().trim().min(1).max(DEFAULT_MAX_CHARS),
    reading: z.string().trim().max(DEFAULT_MAX_CHARS).nullish(),
    baseForm: z.string().trim().min(1).max(DEFAULT_MAX_CHARS),
    pos: z.string().trim().max(200).nullish(),
    meaningLanguage: MeaningLanguage,
    context: z
      .object({
        sentence: z.string().trim().min(1).max(CONTEXT_MAX_CHARS),
        articleId: z.string().min(1).max(128).optional()
      })
      .optional()
  })
])

/** The caller's notebook, created on first save. */
async function ensureNotebook(
  userId: string,
  meaningLanguage: MeaningLanguageCode
) {
  await db
    .insert(jpLexicons)
    .values({
      id: nanoid(),
      userId,
      name: NOTEBOOK_NAME,
      kind: "notebook",
      meaningLanguage
    })
    .onConflictDoNothing()
  const [notebook] = await db
    .select({ id: jpLexicons.id })
    .from(jpLexicons)
    .where(and(eq(jpLexicons.userId, userId), eq(jpLexicons.kind, "notebook")))
    .limit(1)
  if (!notebook)
    throw new Error("Notebook was neither created nor found for the caller")
  return notebook
}

/** A context link only survives if the article is the caller's own. */
async function ownedArticleId(articleId: string | undefined, userId: string) {
  if (articleId === undefined) return null
  const [article] = await db
    .select({ id: jpArticles.id })
    .from(jpArticles)
    .where(and(eq(jpArticles.id, articleId), eq(jpArticles.userId, userId)))
    .limit(1)
  return article?.id ?? null
}

type MeaningLanguageCode = z.infer<typeof MeaningLanguage>

const bankWordColumns = {
  id: jpVocab.id,
  word: jpVocab.word,
  reading: jpVocab.reading,
  meaningsZh: jpVocab.meaningsZh,
  meaningsJa: jpVocab.meaningsJa,
  meaningsEn: jpVocab.meaningsEn
}

async function bankWord(vocabId: string) {
  const [word] = await db
    .select(bankWordColumns)
    .from(jpVocab)
    .where(eq(jpVocab.id, vocabId))
    .limit(1)
  return word
}

/**
 * The word bank's meanings in the notebook's language, copied so the notebook
 * list reads like any imported list. Falls back across languages because some
 * words carry only one.
 */
function meaningsIn(
  word: NonNullable<Awaited<ReturnType<typeof bankWord>>>,
  language: MeaningLanguageCode
): string[] {
  const byLanguage = {
    zh: word.meaningsZh ?? [],
    ja: word.meaningsJa ?? [],
    en: word.meaningsEn
  }
  const fallback = (["zh", "en", "ja"] as const).find(
    (code) => byLanguage[code].length > 0
  )
  if (byLanguage[language].length > 0) return byLanguage[language]
  return fallback ? byLanguage[fallback] : []
}

function refreshEntryCount(lexiconId: string) {
  return db
    .update(jpLexicons)
    .set({
      entryCount: sql`(select count(*)::int from ${jpLexiconEntries} where ${jpLexiconEntries.lexiconId} = ${lexiconId})`
    })
    .where(eq(jpLexicons.id, lexiconId))
}

/**
 * japanese.notebook.save - Put a word into the caller's 生词本. Saving a word
 * that is already there keeps the first entry (and its context sentence).
 * The word then shows up as a new card in the notebook deck.
 */
const saveWord = protectedProcedure
  .input(SaveInput)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    let entry: {
      headword: string
      reading: string | null
      baseForm: string
      pos: string | null
      meanings: string[]
      vocabId: string | null
      contextSentence: string | null
      contextArticleId: string | null
    }

    if ("vocabId" in input) {
      const word = await bankWord(input.vocabId)
      if (!word) throw new ORPCError("NOT_FOUND", { message: "Word not found" })
      entry = {
        headword: word.word,
        reading: word.reading,
        baseForm: word.word,
        pos: null,
        meanings: meaningsIn(word, input.meaningLanguage),
        vocabId: word.id,
        contextSentence: null,
        contextArticleId: null
      }
    } else {
      const reading = input.reading || null
      const [matched] = await matchVocabulary([
        {
          position: 0,
          headword: input.headword,
          reading,
          readingSource: reading ? "engine" : null,
          meanings: [],
          pos: input.pos ?? null,
          unit: null,
          baseForm: input.baseForm
        }
      ])
      const vocabId = matched?.vocabId ?? null
      const word = vocabId === null ? undefined : await bankWord(vocabId)
      entry = {
        headword: input.headword,
        reading,
        baseForm: input.baseForm,
        pos: input.pos ?? null,
        meanings: word ? meaningsIn(word, input.meaningLanguage) : [],
        vocabId,
        contextSentence: input.context?.sentence ?? null,
        contextArticleId: await ownedArticleId(
          input.context?.articleId,
          userId
        )
      }
    }

    const notebook = await ensureNotebook(userId, input.meaningLanguage)
    const [inserted] = await db
      .insert(jpLexiconEntries)
      .values({
        ...entry,
        lexiconId: notebook.id,
        readingSource: entry.reading ? "engine" : null,
        position: sql`(select coalesce(max(${jpLexiconEntries.position}), 0) + 1 from ${jpLexiconEntries} where ${jpLexiconEntries.lexiconId} = ${notebook.id})`
      })
      .onConflictDoNothing()
      .returning({ id: jpLexiconEntries.id })
    if (inserted) await refreshEntryCount(notebook.id)

    return {
      lexiconId: notebook.id,
      entryId: inserted?.id ?? null,
      alreadySaved: !inserted
    }
  })

/** japanese.notebook.remove - Take an entry out of the caller's notebook. */
const removeWord = protectedProcedure
  .input(z.object({ entryId: z.number().int().positive() }))
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const [removed] = await db
      .delete(jpLexiconEntries)
      .where(
        and(
          eq(jpLexiconEntries.id, input.entryId),
          inArray(
            jpLexiconEntries.lexiconId,
            db
              .select({ id: jpLexicons.id })
              .from(jpLexicons)
              .where(
                and(
                  eq(jpLexicons.userId, userId),
                  eq(jpLexicons.kind, "notebook")
                )
              )
          )
        )
      )
      .returning({ lexiconId: jpLexiconEntries.lexiconId })
    if (!removed)
      throw new ORPCError("NOT_FOUND", { message: "Notebook entry not found" })
    await refreshEntryCount(removed.lexiconId)
    return { lexiconId: removed.lexiconId }
  })

export const japaneseNotebookRouter = {
  save: saveWord,
  remove: removeWord
}
