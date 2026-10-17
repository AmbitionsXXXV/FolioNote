import { createAnalyzer } from "@folionote/japanese"
import type { JapaneseAnalyzer } from "@folionote/japanese"
import { createKuromojiEngine } from "@folionote/japanese/kuromoji"
import { createNodeDictionaryLoader } from "@folionote/japanese/loaders/node"
import { call, ORPCError } from "@orpc/server"
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test"

import { appRouter } from "../../src/routers"
import {
  analyzeJapanese,
  japaneseRouter,
  setJapaneseAnalyzer
} from "../../src/routers/japanese"
import { createMockContext, createMockSession } from "../mocks/context"

const authed = () => createMockContext({ session: createMockSession() })

const expectOrpcCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).toBeInstanceOf(ORPCError)
  expect((error as ORPCError<string, unknown>).code).toBe(code)
}

describe("japanese router", () => {
  let analyzer: JapaneseAnalyzer

  beforeAll(async () => {
    const engine = await createKuromojiEngine({
      loader: createNodeDictionaryLoader()
    })
    analyzer = createAnalyzer({ engine })
  })

  afterEach(() => {
    setJapaneseAnalyzer(null)
  })

  it("is mounted on the app router", () => {
    expect(appRouter.japanese).toBe(japaneseRouter)
  })

  it("rejects callers without a session", async () => {
    setJapaneseAnalyzer(analyzer)
    await expectOrpcCode(
      call(
        analyzeJapanese,
        { text: "日本語" },
        { context: createMockContext() }
      ),
      "UNAUTHORIZED"
    )
  })

  it("answers SERVICE_UNAVAILABLE until the server injects an analyzer", async () => {
    await expectOrpcCode(
      call(analyzeJapanese, { text: "日本語" }, { context: authed() }),
      "SERVICE_UNAVAILABLE"
    )
  })

  it("returns learner words from the injected analyzer", async () => {
    setJapaneseAnalyzer(analyzer)
    const result = await call(
      analyzeJapanese,
      { text: "寿司を食べてみました。" },
      { context: authed() }
    )
    expect(result.words.map((word) => word.surface)).toEqual([
      "寿司",
      "を",
      "食べてみました",
      "。"
    ])
  })

  it("maps empty input to BAD_REQUEST", async () => {
    setJapaneseAnalyzer(analyzer)
    await expectOrpcCode(
      call(analyzeJapanese, { text: "   " }, { context: authed() }),
      "BAD_REQUEST"
    )
  })
})
