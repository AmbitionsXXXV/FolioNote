import { db } from "@folionote/db"
import type { AnalyzedText, JapaneseAnalyzer, Word } from "@folionote/japanese"
import { DEFAULT_MAX_CHARS, JapaneseAnalyzerError } from "@folionote/japanese"
import { call } from "@orpc/server"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { appRouter } from "../../src/routers"
import {
  japaneseRouter,
  setJapaneseAnalyzer,
  setJapaneseUrlFetcher
} from "../../src/routers/japanese"
import {
  analyzeArticle,
  articleWordStats,
  prepareLexiconRows
} from "../../src/routers/japanese-library-helpers"
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

const authed = () =>
  createMockContext({ session: createMockSession({ user: { id: "owner-a" } }) })
const articles = japaneseRouter.articles
const lexicons = japaneseRouter.lexicons
const word = (baseForm: string, overrides: Partial<Word> = {}): Word => ({
  index: 0,
  start: 0,
  end: baseForm.length,
  surface: baseForm,
  morphemeIndexes: [],
  pos: "noun",
  baseForm,
  reading: "ねこ",
  ruby: null,
  romaji: null,
  isPunctuation: false,
  tail: null,
  ...overrides
})
function result(text: string, words: Word[] = [word(text)]): AnalyzedText {
  return {
    text,
    containsJapanese: true,
    engine: { id: "kuromoji", dictVersion: "test" },
    morphemes: [],
    phrases: [],
    words
  }
}
const analyzer: JapaneseAnalyzer = {
  analyze: async (text) => result(text, [word("食べる", { reading: "たべる" })])
}

afterEach(() => {
  vi.restoreAllMocks()
  setJapaneseAnalyzer(null)
  setJapaneseUrlFetcher(null)
  query.mockReset()
  query.mockResolvedValue({ rows: [] })
})

describe("Japanese library API", () => {
  it("imports deduplicated entries in one transaction while the analyzer is disabled", async () => {
    // The recording driver does not implement transactions. Exercise the callback
    // with the same recording connection, without claiming database atomicity.
    const transaction = vi
      .spyOn(db, "transaction")
      .mockImplementation(async (callback) => callback(db as never))
    query.mockResolvedValueOnce({ rows: [["vocab-cat", "猫", "ねこ", []]] })
    const imported = await call(
      lexicons.import,
      {
        name: " 本 ",
        kind: "book",
        meaningLanguage: "zh",
        rows: [
          { headword: "猫", reading: "ねこ", meanings: ["cat"], unit: "1" },
          { headword: "猫", reading: "ねこ", meanings: ["feline"], unit: "2" },
          { headword: "犬" },
          { headword: " " }
        ]
      },
      { context: authed() }
    )
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(imported.id).toBeTruthy()
    expect(imported.summary).toEqual({
      total: 4,
      ready: 2,
      readingsFilled: 0,
      duplicatesMerged: 1,
      errors: 1
    })
    expect(query).toHaveBeenCalledTimes(3)
    const [lexiconSql, lexiconParams] = query.mock.calls[1] ?? []
    expect(lexiconSql).toContain('insert into "jp_lexicons"')
    expect(lexiconParams).toContain("owner-a")
    expect(lexiconParams).toContain("本")
    const [entriesSql, entriesParams] = query.mock.calls[2] ?? []
    expect(entriesSql).toContain('insert into "jp_lexicon_entries"')
    expect(entriesParams).toContain("vocab-cat")
    expect(entriesParams).toContain('["cat","feline"]')
    expect(entriesParams).toContain("1")
    expect(entriesParams).not.toContain("2")
  })

  it("batches large imports inside a single transaction", async () => {
    const transaction = vi
      .spyOn(db, "transaction")
      .mockImplementation(async (callback) => callback(db as never))
    const imported = await call(
      lexicons.import,
      {
        name: "Deck",
        kind: "deck",
        meaningLanguage: "en",
        rows: Array.from({ length: 501 }, (_, index) => ({
          headword: `word${index}`
        }))
      },
      { context: authed() }
    )
    expect(imported.summary.ready).toBe(501)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(
      query.mock.calls.filter(([statement]) =>
        statement.startsWith('insert into "jp_lexicon_entries"')
      )
    ).toHaveLength(2)
  })

  it("maps only the user's duplicate lexicon name constraint to CONFLICT", async () => {
    vi.spyOn(db, "transaction").mockRejectedValueOnce(
      new Error("query failed", {
        cause: { code: "23505", constraint: "jp_lexicons_user_name_unique" }
      })
    )
    await expect(
      call(
        lexicons.import,
        { name: "Book", kind: "book", meaningLanguage: "en", rows: [] },
        { context: authed() }
      )
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("queries vocabulary once for preview and scopes known words to the owner", async () => {
    setJapaneseAnalyzer(analyzer)
    query.mockResolvedValueOnce({ rows: [["食べる", "[]", "N5"]] })
    query.mockResolvedValueOnce({ rows: [["食べる"]] })
    const preview = await call(
      articles.preview,
      { text: "食べた。" },
      { context: authed() }
    )
    expect(preview.stats).toEqual({
      sentences: 1,
      words: 1,
      notInLists: 0,
      levels: { N5: 1, N4: 0, N3: 0, N2: 0, N1: 0, unlisted: 0 }
    })
    expect(preview.newWords).toEqual([])
    expect(
      query.mock.calls.filter(([statement]) =>
        statement.includes('from "jp_vocab"')
      )
    ).toHaveLength(1)
    expect(query.mock.calls[0]?.[0]).toContain('"other_forms" ?| ARRAY[')
    expect(query.mock.calls[1]?.[1]).toContain("owner-a")
  })

  it("returns stored articles with analysis null while the analyzer is disabled", async () => {
    query.mockResolvedValueOnce({
      rows: [
        [
          "article-id",
          "owner-a",
          "題",
          "paste",
          null,
          "本文。",
          null,
          null,
          null,
          null,
          1,
          0,
          "2026-10-17T00:00:00Z",
          "2026-10-17T00:00:00Z"
        ]
      ]
    })
    const article = await call(
      articles.get,
      { id: "article-id" },
      { context: authed() }
    )
    expect(article.analysis).toBeNull()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it("persists lazy analysis with an owner predicate and a null-analysis guard", async () => {
    setJapaneseAnalyzer(analyzer)
    const raw = [
      "article-id",
      "owner-a",
      "題",
      "paste",
      null,
      "本文。",
      null,
      null,
      null,
      null,
      1,
      0,
      "2026-10-17T00:00:00Z",
      "2026-10-17T00:00:00Z"
    ]
    query.mockResolvedValueOnce({ rows: [raw] })
    const analyzed = [...raw]
    const analysis = {
      chunks: [{ start: 0, end: 3, result: result("本文。") }]
    }
    query.mockResolvedValueOnce({
      rows: [analyzed.map((value, index) => (index === 6 ? analysis : value))]
    })
    const article = await call(
      articles.get,
      { id: "article-id" },
      { context: authed() }
    )
    expect(article.analysis).toEqual(analysis)
    const [statement, params] = query.mock.calls[1] ?? []
    expect(statement).toContain('update "jp_articles"')
    expect(statement).toContain('"jp_articles"."analysis" is null')
    expect(params).toContain("owner-a")
    expect(params).toContain("article-id")
  })

  it("mounts all procedures under japanese", () => {
    expect(appRouter.japanese).toBe(japaneseRouter)
    expect(Object.keys(articles).toSorted()).toEqual([
      "create",
      "delete",
      "fetchUrl",
      "get",
      "list",
      "preview",
      "reanalyze"
    ])
    expect(Object.keys(lexicons).toSorted()).toEqual([
      "delete",
      "get",
      "import",
      "list",
      "lookup",
      "validate"
    ])
  })

  it("protects every article and lexicon procedure before any I/O", async () => {
    const options = { context: createMockContext() }
    const calls = [
      () => call(articles.fetchUrl, { url: "https://example.com" }, options),
      () => call(articles.preview, { text: "文" }, options),
      () =>
        call(
          articles.create,
          { title: "題", text: "文", sourceType: "paste" },
          options
        ),
      () => call(articles.list, undefined, options),
      () => call(articles.get, { id: "id" }, options),
      () => call(articles.delete, { id: "id" }, options),
      () => call(articles.reanalyze, { id: "id" }, options),
      () => call(lexicons.validate, { rows: [] }, options),
      () =>
        call(
          lexicons.import,
          { name: "本", kind: "book", meaningLanguage: "zh", rows: [] },
          options
        ),
      () => call(lexicons.list, undefined, options),
      () => call(lexicons.get, { id: "id", limit: 10 }, options),
      () => call(lexicons.delete, { id: "id" }, options),
      () => call(lexicons.lookup, { baseForms: ["猫"] }, options)
    ]
    for (const invoke of calls)
      await expect(invoke()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(query).not.toHaveBeenCalled()
  })

  it("returns unavailable for preview and fetch until injected", async () => {
    await expect(
      call(articles.preview, { text: "日本語" }, { context: authed() })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" })
    await expect(
      call(
        articles.fetchUrl,
        { url: "https://example.com" },
        { context: authed() }
      )
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" })
    expect(query).not.toHaveBeenCalled()
  })

  it("validates and merges rows without an analyzer or database", async () => {
    const validated = await call(
      lexicons.validate,
      {
        rows: [
          { headword: " 猫 ", meanings: ["cat"] },
          { headword: "猫", meanings: ["feline"] },
          { headword: " " }
        ]
      },
      { context: authed() }
    )
    expect(validated.summary).toEqual({
      total: 3,
      ready: 1,
      readingsFilled: 0,
      duplicatesMerged: 1,
      errors: 1
    })
    expect(validated.rows.map((row) => row.status)).toEqual([
      "ready",
      "duplicate",
      "error"
    ])
    expect(validated.rows[0]?.reading).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it("fetches independently of the analyzer, caps content, and preserves blocked-URL errors", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      url,
      bytes: new TextEncoder().encode(`題\n${"字".repeat(20_000)}`),
      contentType: "text/plain"
    }))
    setJapaneseUrlFetcher(fetcher)
    const fetched = await call(
      articles.fetchUrl,
      { url: "https://example.com/article" },
      { context: authed() }
    )
    expect(fetched.title).toBe("題")
    expect(fetched.text).toHaveLength(20_000)
    expect(fetched.truncated).toBe(true)
    expect(fetcher).toHaveBeenCalledWith("https://example.com/article")
    setJapaneseUrlFetcher(async () => {
      throw new Error("URL resolves to a private address")
    })
    await expect(
      call(
        articles.fetchUrl,
        { url: "http://localhost" },
        { context: authed() }
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "URL resolves to a private address"
    })
  })

  it("uses HTML titles when available, or the host for empty content", async () => {
    setJapaneseUrlFetcher(async (url) => ({
      url,
      bytes: new TextEncoder().encode("<title>記事</title>本文"),
      contentType: "text/html"
    }))
    const html = await call(
      articles.fetchUrl,
      { url: "https://example.com/a" },
      { context: authed() }
    )
    expect(html.title).toBe("記事")
    expect(html.text).toBe("本文")
    setJapaneseUrlFetcher(async (url) => ({
      url,
      bytes: new Uint8Array(),
      contentType: "text/plain"
    }))
    const empty = await call(
      articles.fetchUrl,
      { url: "https://example.com/a" },
      { context: authed() }
    )
    expect(empty.title).toBe("example.com")
  })

  it.each([
    ["EMPTY_INPUT", "BAD_REQUEST"],
    ["INPUT_TOO_LONG", "BAD_REQUEST"],
    ["ENGINE_UNAVAILABLE", "SERVICE_UNAVAILABLE"]
  ] as const)(
    "maps %s consistently in article and lexicon analysis",
    async (code, expected) => {
      setJapaneseAnalyzer({
        analyze: async () => {
          throw new JapaneseAnalyzerError(code, "engine message")
        }
      })
      await expect(
        call(articles.preview, { text: "日本語" }, { context: authed() })
      ).rejects.toMatchObject({ code: expected, message: "engine message" })
      await expect(
        call(
          lexicons.validate,
          { rows: [{ headword: "日本語" }] },
          { context: authed() }
        )
      ).rejects.toMatchObject({ code: expected, message: "engine message" })
    }
  )

  it("enforces request bounds before I/O", async () => {
    await expect(
      call(
        articles.preview,
        { text: "文".repeat(20_001) },
        { context: authed() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(
      call(
        lexicons.validate,
        { rows: Array.from({ length: 5001 }, () => ({ headword: "猫" })) },
        { context: authed() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(
      call(
        lexicons.lookup,
        { baseForms: Array.from({ length: 501 }, () => "猫") },
        { context: authed() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(query).not.toHaveBeenCalled()
  })

  it("scopes reads and deletes to the owner and masks absent/foreign IDs", async () => {
    const options = { context: authed() }
    const calls = [
      () => call(articles.get, { id: "foreign-id" }, options),
      () => call(articles.delete, { id: "foreign-id" }, options),
      () => call(articles.reanalyze, { id: "foreign-id" }, options),
      () => call(lexicons.get, { id: "foreign-id", limit: 10 }, options),
      () => call(lexicons.delete, { id: "foreign-id" }, options)
    ]
    for (const invoke of calls) {
      await expect(invoke()).rejects.toMatchObject({ code: "NOT_FOUND" })
      const [statement, params] = query.mock.calls.at(-1) ?? []
      expect(statement).toContain('"user_id" =')
      expect(params).toContain("owner-a")
      expect(params).toContain("foreign-id")
    }
  })

  it("scopes list and lookup queries to the owner", async () => {
    await call(articles.list, undefined, { context: authed() })
    await call(lexicons.list, undefined, { context: authed() })
    await call(lexicons.lookup, { baseForms: ["猫"] }, { context: authed() })
    for (const [statement, params] of query.mock.calls) {
      expect(statement).toContain('"user_id" =')
      expect(params).toContain("owner-a")
    }
    expect(query).toHaveBeenCalledTimes(3)
  })

  it("saves an unanalyzed article when the engine is disabled", async () => {
    query.mockResolvedValueOnce({
      rows: [
        [
          "article-id",
          "owner-a",
          "題",
          "paste",
          null,
          "本文。",
          null,
          null,
          null,
          null,
          1,
          0,
          "2026-10-17T00:00:00Z",
          "2026-10-17T00:00:00Z"
        ]
      ]
    })
    const article = await call(
      articles.create,
      { title: "題", text: "本文。", sourceType: "paste" },
      { context: authed() }
    )
    expect(article.analysis).toBeNull()
    expect(article.sentenceCount).toBe(1)
    expect(article.wordCount).toBe(0)
    const [statement, params] = query.mock.calls[0] ?? []
    expect(statement).toContain('insert into "jp_articles"')
    expect(params).toContain("owner-a")
    expect(params).toContain("本文。")
  })
})

describe("Japanese library helpers", () => {
  it("fills readings, retains file readings, merges meanings and keeps first position/unit", async () => {
    const analyzed = vi.fn(analyzer.analyze)
    const prepared = await prepareLexiconRows(
      [
        { headword: " 食べた ", meanings: [" ate ", ""], unit: "1" },
        {
          headword: "食べた",
          reading: "たべる",
          meanings: ["ate", "eat"],
          unit: "2"
        },
        { headword: "食べた", reading: "たべた", meanings: ["ate"] },
        { headword: " " }
      ],
      { analyze: analyzed }
    )
    expect(prepared.summary).toEqual({
      total: 4,
      ready: 2,
      readingsFilled: 1,
      duplicatesMerged: 1,
      errors: 1
    })
    expect(prepared.entries[0]).toMatchObject({
      headword: "食べた",
      baseForm: "食べる",
      reading: "たべる",
      readingSource: "engine",
      position: 0,
      unit: "1",
      meanings: ["ate", "eat"]
    })
    expect(prepared.entries[1]).toMatchObject({
      reading: "たべた",
      readingSource: "file"
    })
    expect(analyzed).toHaveBeenCalledTimes(1)
  })

  it("falls back to headword and null reading with the engine absent", async () => {
    const prepared = await prepareLexiconRows(
      [
        { headword: "猫", meanings: ["cat"] },
        { headword: "猫", reading: " ", meanings: ["feline"] }
      ],
      null
    )
    expect(prepared.entries).toEqual([
      {
        headword: "猫",
        baseForm: "猫",
        reading: null,
        readingSource: null,
        meanings: ["cat", "feline"],
        pos: null,
        unit: null,
        position: 0
      }
    ])
  })

  it("joins all word readings and does not invent partial or non-Japanese readings", async () => {
    const prepared = await prepareLexiconRows([{ headword: "猫犬" }], {
      analyze: async (text) =>
        result(text, [
          word("猫", { reading: "ねこ" }),
          word("犬", { reading: "いぬ" })
        ])
    })
    expect(prepared.entries[0]?.reading).toBe("ねこいぬ")
    const missing = await prepareLexiconRows([{ headword: "猫unknown" }], {
      analyze: async (text) =>
        result(text, [word("猫"), word("unknown", { reading: null })])
    })
    expect(missing.entries[0]?.reading).toBeNull()
  })

  it("counts occurrences by dictionary form and alternate spellings with deterministic level selection", () => {
    const stats = articleWordStats(
      [
        word("猫"),
        word("猫"),
        word("食べる"),
        word("喰べる"),
        word("未知"),
        word("を", { pos: "particle" }),
        word("。", { isPunctuation: true })
      ],
      [
        { word: "食べる", otherForms: ["喰べる"], level: "N4" },
        { word: "猫", otherForms: [], level: "N1" },
        { word: "猫", otherForms: [], level: "N5" }
      ],
      new Set(["食べる"])
    )
    expect(stats.words).toBe(5)
    expect(stats.notInLists).toBe(4)
    expect(stats.levels).toEqual({
      N5: 2,
      N4: 2,
      N3: 0,
      N2: 0,
      N1: 0,
      unlisted: 1
    })
    expect(stats.newWords[0]).toEqual({
      baseForm: "猫",
      reading: "ねこ",
      count: 2
    })
    expect(stats.newWords.some((entry) => entry.baseForm === "食べる")).toBe(
      false
    )
    expect(
      articleWordStats(
        Array.from({ length: 40 }, (_, i) => word(`word${i}`)),
        [],
        new Set()
      ).newWords
    ).toHaveLength(30)
  })

  it("analyzes sentence-aligned chunks within the engine limit with original offsets", async () => {
    const text = `${"字".repeat(DEFAULT_MAX_CHARS - 1)}。次です！${"長".repeat(DEFAULT_MAX_CHARS + 1)}`
    const analyze = vi.fn(async (part: string) => result(part))
    const analysis = await analyzeArticle(text, { analyze })
    expect(analysis.chunks[0]?.end).toBe(DEFAULT_MAX_CHARS)
    expect(analysis.chunks.map((chunk) => chunk.result.text).join("")).toBe(
      text
    )
    for (const chunk of analysis.chunks) {
      expect(chunk.result.text).toBe(text.slice(chunk.start, chunk.end))
      expect(chunk.end - chunk.start).toBeLessThanOrEqual(DEFAULT_MAX_CHARS)
    }
  })
})

describe("article import resilience", () => {
  const raw = [
    "article-id",
    "owner-a",
    "題",
    "paste",
    null,
    "本文。",
    null,
    null,
    null,
    null,
    1,
    0,
    "2026-10-17T00:00:00Z",
    "2026-10-17T00:00:00Z"
  ]
  it.each(["create", "get"] as const)(
    "returns analysis null when %s analysis fails",
    async (method) => {
      const logged = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined)
      setJapaneseAnalyzer({
        analyze: async () => {
          throw new Error("engine crashed")
        }
      })
      query.mockResolvedValueOnce({ rows: [raw] })
      const article =
        method === "get"
          ? await call(
              articles.get,
              { id: "article-id" },
              { context: authed() }
            )
          : await call(
              articles.create,
              { title: "題", text: "本文。", sourceType: "paste" },
              { context: authed() }
            )
      expect(article.analysis).toBeNull()
      expect(article.text).toBe("本文。")
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining("japanese-library"),
        expect.any(String),
        expect.any(Error)
      )
      expect(query).toHaveBeenCalledTimes(1)
      if (method === "create")
        expect(query.mock.calls[0]?.[0]).toContain('insert into "jp_articles"')
    }
  )
  it.each([
    // eslint-disable-next-line no-script-url -- Reject untrusted article source URLs.
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd",
    "ftp://example.com/a"
  ])("rejects sourceUrl %s before saving", async (sourceUrl) => {
    await expect(
      call(
        articles.create,
        { title: "題", text: "本文。", sourceType: "url", sourceUrl },
        { context: authed() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(query).not.toHaveBeenCalled()
  })
  it.each(["http://example.com/a", "https://example.com/a"])(
    "accepts sourceUrl %s",
    async (sourceUrl) => {
      query.mockResolvedValueOnce({ rows: [raw] })
      await call(
        articles.create,
        { title: "題", text: "本文。", sourceType: "url", sourceUrl },
        { context: authed() }
      )
      expect(query.mock.calls[0]?.[1]).toContain(sourceUrl)
    }
  )
  it("decodes raw Shift_JIS HTML", async () => {
    const prefix = new TextEncoder().encode("<title>&copy;</title><p><b>")
    // Keep all non-ASCII body bytes in the declared charset.
    setJapaneseUrlFetcher(async (url) => ({
      url,
      contentType: "text/html; charset=shift_jis",
      bytes: new Uint8Array([
        ...prefix,
        0x93,
        0xfa,
        0x96,
        0x7b,
        0x8c,
        0xea,
        ...new TextEncoder().encode("</b></p>")
      ])
    }))
    const fetched = await call(
      articles.fetchUrl,
      { url: "https://example.com" },
      { context: authed() }
    )
    expect(fetched).toEqual({ title: "©", text: "日本語", truncated: false })
  })
  it("leaves plain-text content unchanged", async () => {
    setJapaneseUrlFetcher(async (url) => ({
      url,
      contentType: "text/plain",
      bytes: new TextEncoder().encode("<b>本文</b>\n\n末\n")
    }))
    const article = await call(
      articles.fetchUrl,
      { url: "https://example.com" },
      { context: authed() }
    )
    expect(article.text).toBe("<b>本文</b>\n\n末\n")
  })
})
