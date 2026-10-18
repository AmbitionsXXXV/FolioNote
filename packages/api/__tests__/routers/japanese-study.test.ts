import { call, ORPCError } from "@orpc/server"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { japaneseRouter } from "../../src/routers/japanese"
import { japaneseStudyRouter } from "../../src/routers/japanese-study"
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

const study = japaneseStudyRouter
const authed = () =>
  createMockContext({ session: createMockSession({ user: { id: "owner-a" } }) })

const expectOrpcCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).toBeInstanceOf(ORPCError)
  expect((error as ORPCError<string, unknown>).code).toBe(code)
}

afterEach(() => {
  query.mockReset()
  query.mockResolvedValue({ rows: [] })
})

describe("Japanese study API", () => {
  it("is mounted under japanese.study", () => {
    expect(japaneseRouter.study).toBe(study)
  })

  it("rejects callers without a session", async () => {
    await expectOrpcCode(
      call(study.decks, undefined, { context: createMockContext() }),
      "UNAUTHORIZED"
    )
  })

  it("groups MOJi lists by an inlined key so GROUP BY matches SELECT", async () => {
    await call(study.decks, undefined, { context: authed() })
    const mojiSql = query.mock.calls
      .map(([statement]) => statement)
      .find((statement) => statement.includes("collectionTitle"))
    expect(mojiSql).toContain(
      `group by "jp_vocab"."source_details"->'moji'->>'collectionId'`
    )
  })

  it("serves due cards before new ones, scoped to the caller", async () => {
    await call(
      study.queue,
      { deck: { kind: "level", level: "N5" }, limit: 5 },
      { context: authed() }
    )
    const [dueSql, dueParams] = query.mock.calls[0] ?? []
    expect(dueSql).toContain('order by "jp_study_state"."due_at"')
    expect(dueParams).toEqual(expect.arrayContaining(["owner-a", "N5"]))
    // No due cards, so the batch is filled with unseen words in deck order.
    const [freshSql, freshParams] = query.mock.calls[1] ?? []
    expect(freshSql).toContain('"jp_study_state"."id" is null')
    expect(freshParams).toEqual(expect.arrayContaining(["owner-a", "N5", 5]))
  })

  it("answers NOT_FOUND for another user's word list", async () => {
    await expectOrpcCode(
      call(
        study.queue,
        { deck: { kind: "lexicon", id: "someone-elses" } },
        { context: authed() }
      ),
      "NOT_FOUND"
    )
  })

  it("rejects an unknown word without writing progress", async () => {
    await expectOrpcCode(
      call(
        study.rate,
        { key: { vocabId: "missing" }, rating: "good" },
        { context: authed() }
      ),
      "NOT_FOUND"
    )
    expect(query).toHaveBeenCalledTimes(1)
  })

  it("makes matched list entries share their word's progress", async () => {
    query.mockResolvedValueOnce({ rows: [[7, "vocab-cat"]] })
    await expectOrpcCode(
      call(
        study.rate,
        { key: { lexiconEntryId: 7 }, rating: "good" },
        { context: authed() }
      ),
      "BAD_REQUEST"
    )
  })

  it("upserts the scheduled state for a first rating", async () => {
    query
      .mockResolvedValueOnce({ rows: [["vocab-cat"]] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [["2026-10-19T00:00:00.000Z", 1]] })
    const saved = await call(
      study.rate,
      { key: { vocabId: "vocab-cat" }, rating: "good" },
      { context: authed() }
    )
    expect(saved?.intervalDays).toBe(1)
    const [insertSql, insertParams] = query.mock.calls[2] ?? []
    expect(insertSql).toContain('insert into "jp_study_state"')
    expect(insertSql).toContain('on conflict ("user_id","vocab_id") do update')
    expect(insertParams).toEqual(
      expect.arrayContaining(["owner-a", "vocab-cat"])
    )
  })
})
