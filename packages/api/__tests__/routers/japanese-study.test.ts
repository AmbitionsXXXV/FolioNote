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
  const error = await promise.then(() => null).catch((error: unknown) => error)
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

  it("limits a part-of-speech book by JMdict codes and caps new cards", async () => {
    await call(
      study.queue,
      {
        deck: { kind: "level", level: "N4", pos: "verb" },
        limit: 20,
        newLimit: 3
      },
      { context: authed() }
    )
    const [dueSql] = query.mock.calls[0] ?? []
    expect(dueSql).toContain('"jp_vocab"."jmdict_pos" ?| array[')
    expect(dueSql).toContain("like 'v5%'")
    const [, freshParams] = query.mock.calls[1] ?? []
    // Twenty cards were asked for, but only three of them may be new.
    expect(freshParams?.at(-1)).toBe(3)
  })

  it("skips unseen cards entirely when today's new words are done", async () => {
    await call(
      study.queue,
      { deck: { kind: "level", level: "N5" }, limit: 20, newLimit: 0 },
      { context: authed() }
    )
    expect(query).toHaveBeenCalledTimes(1)
  })

  it("applies a replayed offline rating only once", async () => {
    query
      .mockResolvedValueOnce({ rows: [["vocab-cat", "猫"]] })
      .mockResolvedValueOnce({ rows: [["jp-rate:owner-a:abcdefgh"]] })
      .mockResolvedValueOnce({ rows: [["2026-10-19T00:00:00.000Z", 3]] })
    const saved = await call(
      study.rate,
      {
        key: { vocabId: "vocab-cat" },
        rating: "good",
        clientId: "abcdefgh",
        occurredAt: new Date()
      },
      { context: authed() }
    )
    expect(saved?.progress).toBeNull()
    expect(saved?.intervalDays).toBe(3)
    const [seenSql, seenParams] = query.mock.calls[1] ?? []
    expect(seenSql).toContain('from "learning_activities"')
    expect(seenParams).toEqual(["jp-rate:owner-a:abcdefgh", 1])
    const statements = query.mock.calls.map(([statement]) => statement)
    expect(statements.some((sql) => sql.startsWith("insert"))).toBe(false)
  })

  it("rejects malformed client ids", async () => {
    await expectOrpcCode(
      call(
        study.rate,
        { key: { vocabId: "vocab-cat" }, rating: "good", clientId: "x y" },
        { context: authed() }
      ),
      "BAD_REQUEST"
    )
  })

  it("stores the deck as JSON and validates plan options", async () => {
    query.mockResolvedValueOnce({
      rows: [
        [
          "owner-a",
          15,
          null,
          '{"kind":"level","level":"N4","pos":"verb"}',
          "2026-11-28T00:00:00.000Z"
        ]
      ]
    })
    const saved = await call(
      study.updatePlan,
      { dailyNewWords: 15, deck: { kind: "level", level: "N4", pos: "verb" } },
      { context: authed() }
    )
    expect(saved.deck).toEqual({ kind: "level", level: "N4", pos: "verb" })
    const [insertSql, insertParams] = query.mock.calls[0] ?? []
    expect(insertSql).toContain('insert into "jp_study_plans"')
    expect(insertParams).toEqual(
      expect.arrayContaining(['{"kind":"level","level":"N4","pos":"verb"}'])
    )
    await expectOrpcCode(
      call(study.updatePlan, { dailyNewWords: 51 }, { context: authed() }),
      "BAD_REQUEST"
    )
  })
})
