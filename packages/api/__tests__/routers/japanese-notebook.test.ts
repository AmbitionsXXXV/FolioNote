import { call, ORPCError } from "@orpc/server"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { japaneseRouter } from "../../src/routers/japanese"
import { japaneseNotebookRouter } from "../../src/routers/japanese-notebook"
import { createMockContext, createMockSession } from "../mocks/context"

// Compile real Drizzle queries against a recording driver; never open a database.
const query = vi.hoisted(() =>
  vi.fn(async (_sql: string, _params: unknown[]) => ({
    rows: [] as unknown[][]
  }))
)
vi.mock("@folionote/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@folionote/db")>()
  const { drizzle } = await import("drizzle-orm/pg-proxy")
  return { ...original, db: drizzle(query) }
})

const notebook = japaneseNotebookRouter
const authed = () =>
  createMockContext({ session: createMockSession({ user: { id: "owner-a" } }) })

const expectOrpcCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(() => null).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(ORPCError)
  expect((error as ORPCError<string, unknown>).code).toBe(code)
}

// id, word, reading, meanings_zh, meanings_ja, meanings_en
const CAT_ROW = ["vocab-cat", "猫", "ねこ", null, null, ["cat"]]

const statements = () => query.mock.calls.map(([statement]) => statement)

afterEach(() => {
  query.mockReset()
  query.mockResolvedValue({ rows: [] })
})

describe("Japanese notebook API", () => {
  it("is mounted under japanese.notebook", () => {
    expect(japaneseRouter.notebook).toBe(notebook)
  })

  it("rejects callers without a session", async () => {
    await expectOrpcCode(
      call(
        notebook.save,
        { vocabId: "vocab-cat", meaningLanguage: "zh" },
        { context: createMockContext() }
      ),
      "UNAUTHORIZED"
    )
  })

  it("rejects an unknown word without creating a notebook", async () => {
    await expectOrpcCode(
      call(
        notebook.save,
        { vocabId: "missing", meaningLanguage: "zh" },
        { context: authed() }
      ),
      "NOT_FOUND"
    )
    expect(query).toHaveBeenCalledTimes(1)
  })

  it("saves a word-bank word into the caller's notebook", async () => {
    query
      .mockResolvedValueOnce({ rows: [CAT_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [["nb-1"]] })
      .mockResolvedValueOnce({ rows: [[42, true]] })
    const saved = await call(
      notebook.save,
      { vocabId: "vocab-cat", meaningLanguage: "zh" },
      { context: authed() }
    )
    expect(saved).toEqual({ lexiconId: "nb-1", entryId: 42, alreadySaved: false })

    const [notebookSql, notebookParams] = query.mock.calls[1] ?? []
    expect(notebookSql).toContain('insert into "jp_lexicons"')
    expect(notebookSql).toContain("on conflict do nothing")
    expect(notebookParams).toEqual(
      expect.arrayContaining(["owner-a", "notebook"])
    )
    const [entrySql, entryParams] = query.mock.calls[3] ?? []
    expect(entrySql).toContain('insert into "jp_lexicon_entries"')
    expect(entrySql).toContain(
      'on conflict ("lexicon_id","headword","reading") do update'
    )
    expect(entrySql).toContain("where excluded.context_sentence is not null")
    expect(entryParams).toEqual(
      expect.arrayContaining(["nb-1", "猫", "ねこ", "vocab-cat"])
    )
    // No Chinese gloss in the word bank, so the English one is copied.
    expect(entryParams).toContain(JSON.stringify(["cat"]))
    expect(statements()[4]).toContain('update "jp_lexicons"')
  })

  it("reports a word that is already saved and leaves the count alone", async () => {
    query
      .mockResolvedValueOnce({ rows: [CAT_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [["nb-1"]] })
      .mockResolvedValueOnce({ rows: [] })
    const saved = await call(
      notebook.save,
      { vocabId: "vocab-cat", meaningLanguage: "zh" },
      { context: authed() }
    )
    expect(saved).toEqual({ lexiconId: "nb-1", entryId: null, alreadySaved: true })
    expect(query).toHaveBeenCalledTimes(4)
  })

  it("moves an already-saved word to its newest sentence without recounting", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [["nb-1"]] })
      .mockResolvedValueOnce({ rows: [[43, false]] })
    const saved = await call(
      notebook.save,
      {
        headword: "食べた",
        reading: "たべた",
        baseForm: "食べる",
        meaningLanguage: "zh",
        context: { sentence: "パンを食べた。" }
      },
      { context: authed() }
    )
    expect(saved).toEqual({ lexiconId: "nb-1", entryId: 43, alreadySaved: true })
    expect(query).toHaveBeenCalledTimes(5)
  })

  it("keeps the context sentence but drops another user's article link", async () => {
    // Word-bank match finds nothing, then the article is not the caller's.
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [["nb-1"]] })
      .mockResolvedValueOnce({ rows: [[43, true]] })
    await call(
      notebook.save,
      {
        headword: "食べた",
        reading: "たべた",
        baseForm: "食べる",
        meaningLanguage: "zh",
        context: { sentence: "パンを食べた。", articleId: "their-article" }
      },
      { context: authed() }
    )
    const [articleSql, articleParams] = query.mock.calls[1] ?? []
    expect(articleSql).toContain('from "jp_articles"')
    expect(articleParams).toEqual(
      expect.arrayContaining(["their-article", "owner-a"])
    )
    const [entrySql, entryParams] = query.mock.calls[4] ?? []
    expect(entrySql).toContain('insert into "jp_lexicon_entries"')
    expect(entryParams).toEqual(
      expect.arrayContaining(["食べた", "食べる", "パンを食べた。"])
    )
    expect(entryParams).not.toContain("their-article")
  })

  it("only removes entries from the caller's own notebook", async () => {
    await expectOrpcCode(
      call(notebook.remove, { entryId: 7 }, { context: authed() }),
      "NOT_FOUND"
    )
    const [deleteSql, deleteParams] = query.mock.calls[0] ?? []
    expect(deleteSql).toContain('delete from "jp_lexicon_entries"')
    expect(deleteParams).toEqual(
      expect.arrayContaining([7, "owner-a", "notebook"])
    )
    expect(query).toHaveBeenCalledTimes(1)
  })

  it("has no summary before the first save", async () => {
    const result = await call(notebook.summary, undefined, { context: authed() })
    expect(result).toBeNull()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it("summarizes the caller's notebook with its latest words", async () => {
    query
      .mockResolvedValueOnce({ rows: [["nb-1", 5]] })
      .mockResolvedValueOnce({ rows: [["小説"], ["図書館"]] })
    const result = await call(notebook.summary, undefined, { context: authed() })
    expect(result).toEqual({ id: "nb-1", entryCount: 5, recent: ["小説", "図書館"] })
    const [notebookSql, notebookParams] = query.mock.calls[0] ?? []
    expect(notebookSql).toContain('from "jp_lexicons"')
    expect(notebookParams).toEqual(expect.arrayContaining(["owner-a", "notebook"]))
    expect(statements()[1]).toContain("order by")
  })
})
