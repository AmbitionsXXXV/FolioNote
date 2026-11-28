import { call, ORPCError } from "@orpc/server"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { appRouter } from "../../src/routers"
import { listeningRouter } from "../../src/routers/listening"
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
const fetchInfo = vi.hoisted(() => vi.fn())
vi.mock("../../src/connectors/youtube", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/connectors/youtube")>()
  return { ...original, fetchYouTubeVideoInfo: fetchInfo }
})

const listening = listeningRouter
const authed = () =>
  createMockContext({ session: createMockSession({ user: { id: "owner-a" } }) })
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n"

const expectOrpcCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(() => null).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(ORPCError)
  expect((error as ORPCError<string, unknown>).code).toBe(code)
}

afterEach(() => {
  query.mockReset()
  query.mockResolvedValue({ rows: [] })
  fetchInfo.mockReset()
})

describe("listening API", () => {
  it("is mounted under listening", () => {
    expect(appRouter.listening).toBe(listening)
  })

  it("rejects callers without a session", async () => {
    await expectOrpcCode(
      call(listening.list, undefined, { context: createMockContext() }),
      "UNAUTHORIZED"
    )
  })

  it("rejects links that aren't a single video before touching anything", async () => {
    await expectOrpcCode(
      call(
        listening.create,
        {
          url: "https://www.youtube.com/playlist?list=PL1",
          captions: { text: SRT }
        },
        { context: authed() }
      ),
      "BAD_REQUEST"
    )
    expect(fetchInfo).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it("rejects captions without timed lines", async () => {
    await expectOrpcCode(
      call(
        listening.create,
        { url: "https://youtu.be/dQw4w9WgXcQ", captions: { text: "no times" } },
        { context: authed() }
      ),
      "BAD_REQUEST"
    )
    expect(query).not.toHaveBeenCalled()
  })

  it("refuses videos whose owner disabled embedding", async () => {
    fetchInfo.mockResolvedValueOnce({
      channelTitle: null,
      durationSeconds: 60,
      embeddable: false,
      source: "data_api",
      thumbnailUrl: null,
      title: "No embeds",
      videoId: "dQw4w9WgXcQ"
    })
    await expectOrpcCode(
      call(
        listening.create,
        { url: "https://youtu.be/dQw4w9WgXcQ", captions: { text: SRT } },
        { context: authed() }
      ),
      "BAD_REQUEST"
    )
    expect(query).not.toHaveBeenCalled()
  })

  it("only reads the caller's own material", async () => {
    await expectOrpcCode(
      call(listening.get, { id: "foreign" }, { context: authed() }),
      "NOT_FOUND"
    )
    const [sql, params] = query.mock.calls[0] ?? []
    expect(sql).toContain('from "study_materials"')
    expect(params).toEqual(expect.arrayContaining(["foreign", "owner-a"]))
  })

  it("saves progress without recording an activity until the video is finished", async () => {
    query.mockResolvedValueOnce({ rows: [["m-1", "Title"]] })
    const result = await call(
      listening.progress,
      { id: "m-1", segmentIndex: 3 },
      { context: authed() }
    )
    expect(result).toEqual({ progress: null })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toContain('update "study_materials"')
  })

  it("records a finished video only when completed_at was still empty", async () => {
    query
      .mockResolvedValueOnce({ rows: [["m-1", "Title"]] })
      .mockResolvedValueOnce({ rows: [] })
    const result = await call(
      listening.progress,
      { id: "m-1", segmentIndex: 9, completed: true },
      { context: authed() }
    )
    expect(result).toEqual({ progress: null })
    expect(query.mock.calls[1]?.[0]).toContain('"completed_at" is null')
    expect(
      query.mock.calls.some(([statement]) =>
        statement.includes("learning_activities")
      )
    ).toBe(false)
  })
})
