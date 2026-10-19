import { createHash } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { loadOpenJlpt, main, seedOpenJlpt } from "../scripts/seed-openjlpt"

// Exercise real Drizzle SQL generation against an in-memory pg transport.
// No test in this file can connect to a database or download data.
const mocks = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  openPool: vi.fn(),
  query: vi.fn(async (_query: { text: string }, _params: unknown[]) => ({
    rows: []
  })),
  release: vi.fn(),
  end: vi.fn(async () => undefined),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  fetch: vi.fn()
}))

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async (path: string, encoding?: string) => {
    const key = path.endsWith("/data/openjlpt.lock.json") ? "lock" : path
    const bytes = mocks.files.get(key)
    if (!bytes)
      throw Object.assign(new Error(`Missing ${path}`), { code: "ENOENT" })
    return encoding ? bytes.toString("utf-8") : bytes
  }),
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile
}))
vi.mock("dotenv/config", () => ({}))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      constructor() {
        mocks.openPool()
      }
      async connect() {
        return { query: mocks.query, release: mocks.release }
      }
      end = mocks.end
    },
    types: {}
  }
}))

const levels = ["N5", "N4", "N3", "N2", "N1"]
let files: Record<string, unknown>

function installFixture(layout: "flat" | "full" = "flat"): void {
  mocks.files.clear()
  const hashes: Record<string, string> = {}
  for (const [path, value] of Object.entries(files)) {
    const bytes = Buffer.from(JSON.stringify(value))
    hashes[`data/json/${path}`] = createHash("sha256")
      .update(bytes)
      .digest("hex")
    mocks.files.set(
      `/fixture/${layout === "full" ? "data/json/" : ""}${path}`,
      bytes
    )
  }
  mocks.files.set(
    "lock",
    Buffer.from(
      JSON.stringify({
        repo: "evanclan/OpenJLPT",
        commit: "a".repeat(40),
        version: "0.3.0",
        license: "CC-BY-SA-4.0",
        files: hashes
      })
    )
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://unused.invalid/no-connection")
  vi.stubGlobal("fetch", mocks.fetch)
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  mocks.query.mockImplementation(async () => ({ rows: [] }))
  files = {
    "meta.json": { name: "OpenJLPT", version: "0.3.0", license: "CC-BY-SA-4.0" }
  }
  for (const level of levels) {
    const filename = `${level.toLowerCase()}.json`
    files[`vocab/${filename}`] = [
      {
        id: level.slice(1).repeat(10),
        word: "日",
        reading: "ひ",
        romaji: "hi",
        meanings: ["day"],
        level,
        examples: [{ ja: "日", en: "day", furigana: "{日|ひ}", tatoeba_id: 1 }]
      }
    ]
    files[`kanji/${filename}`] = [
      {
        character: `日${level}`,
        level,
        strokes: 4,
        grade: 1,
        freq: null,
        radical: "日",
        radical_number: 72,
        onyomi: ["ニチ"],
        kunyomi: ["ひ"],
        meanings: ["day"]
      }
    ]
    files[`grammar/${filename}`] = [
      {
        id: `wa-${level}`,
        pattern: "〜は",
        romaji: "wa",
        level,
        meaning: "topic",
        formation: "Noun + は",
        examples: [{ ja: "私は学生です。", en: "I am a student." }],
        tags: []
      }
    ]
  }
  installFixture()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("OpenJLPT source validation", () => {
  it.each(["flat", "full"] as const)(
    "dry-runs the %s layout without creating a pool",
    async (layout) => {
      installFixture(layout)
      await main(["--dry-run", "--source-dir", "/fixture"])
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("SHA-256 OK: 16 files")
      )
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("jp_vocab_examples: 5")
      )
      expect(mocks.openPool).not.toHaveBeenCalled()
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )

  it("rejects tampering in the last file before any database work", async () => {
    mocks.files.set("/fixture/grammar/n1.json", Buffer.from("[]"))
    await expect(main(["--source-dir", "/fixture"])).rejects.toThrow(
      "SHA-256 mismatch for data/json/grammar/n1.json"
    )
    expect(mocks.openPool).not.toHaveBeenCalled()
  })

  it.each(["vocab", "kanji", "grammar"])(
    "rejects invalid %s fields after hashes pass",
    async (kind) => {
      files[`${kind}/n1.json`] = [{ level: "N1" }]
      installFixture()
      await expect(main(["--source-dir", "/fixture"])).rejects.toThrow(
        `Invalid OpenJLPT data in data/json/${kind}/n1.json`
      )
      expect(mocks.openPool).not.toHaveBeenCalled()
    }
  )

  it("rejects an empty level file before stale-row deletion", async () => {
    files["vocab/n1.json"] = []
    installFixture()
    await expect(main(["--source-dir", "/fixture"])).rejects.toThrow(
      "Invalid OpenJLPT data in data/json/vocab/n1.json"
    )
    expect(mocks.openPool).not.toHaveBeenCalled()
  })

  it("rejects duplicate primary keys across levels", async () => {
    const rows = files["vocab/n1.json"] as Record<string, unknown>[]
    files["vocab/n1.json"] = rows.map((row) => ({ ...row, id: "5555555555" }))
    installFixture()
    await expect(main(["--source-dir", "/fixture"])).rejects.toThrow(
      "Duplicate jp_vocab key: 5555555555"
    )
    expect(mocks.openPool).not.toHaveBeenCalled()
  })

  it("downloads only pinned paths, verifies them, then uses the cache", async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      expect(url).toContain(
        `https://raw.githubusercontent.com/evanclan/OpenJLPT/${"a".repeat(40)}/data/json/`
      )
      const path = url.split("/data/json/")[1]
      return Response.json(files[path ?? ""])
    })
    mocks.writeFile.mockImplementation(async (path: string, bytes: Buffer) => {
      mocks.files.set(path, bytes)
    })
    await main(["--dry-run"])
    expect(mocks.fetch).toHaveBeenCalledTimes(16)
    expect(mocks.writeFile).toHaveBeenCalledTimes(16)
    mocks.fetch.mockClear()
    await main(["--dry-run"])
    expect(mocks.fetch).not.toHaveBeenCalled()
    const cachePath = [...mocks.files.keys()].find(
      (path) => path.includes("/.cache/") && path.endsWith("grammar/n1.json")
    )
    expect(cachePath).toBeDefined()
    mocks.files.set(cachePath ?? "", Buffer.from("tampered cache"))
    await expect(main(["--dry-run"])).rejects.toThrow(
      "SHA-256 mismatch for data/json/grammar/n1.json"
    )
    expect(mocks.openPool).not.toHaveBeenCalled()
  })
})

describe("OpenJLPT transaction (mock pg transport)", () => {
  it("upserts, replaces examples, deletes stale rows, and commits once", async () => {
    await seedOpenJlpt(await loadOpenJlpt("/fixture"))
    const queries = mocks.query.mock.calls.map(([query]) => query.text)
    expect(queries[0]).toBe("begin")
    expect(queries.at(-1)).toBe("commit")
    expect(queries.filter((query) => query === "begin")).toHaveLength(1)
    expect(
      queries.filter((query) => query.includes("on conflict"))
    ).toHaveLength(3)
    const update = queries
      .find((query) => query.startsWith('insert into "jp_vocab"'))
      ?.split("do update set")[1]
    expect(update).toContain('"source_version" = excluded.source_version')
    expect(update).not.toContain('"meanings_zh"')
    expect(update).not.toContain('"created_at"')
    const deletes = queries.filter((query) => query.startsWith("delete"))
    expect(deletes).toHaveLength(4)
    expect(deletes[0]).toContain('"jp_vocab_examples"."vocab_id" in')
    expect(deletes[1]).toContain('"jp_vocab"."source" =')
    expect(deletes.slice(1).every((query) => query.includes("not in"))).toBe(
      true
    )
    const exampleDeleteIndex = queries.findIndex((query) =>
      query.startsWith('delete from "jp_vocab_examples"')
    )
    expect(queries[exampleDeleteIndex + 1]).toContain(
      'insert into "jp_vocab_examples"'
    )
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it("clears examples even when the replacement list is empty", async () => {
    const data = await loadOpenJlpt("/fixture")
    for (const row of data.vocab) row.examples = []
    await seedOpenJlpt(data)
    const queries = mocks.query.mock.calls.map(([query]) => query.text)
    expect(
      queries.some((query) =>
        query.startsWith('delete from "jp_vocab_examples"')
      )
    ).toBe(true)
    expect(
      queries.some((query) =>
        query.startsWith('insert into "jp_vocab_examples"')
      )
    ).toBe(false)
  })

  it("rolls back and closes the pool when stale-row deletion fails", async () => {
    mocks.query.mockImplementation(async (query) => {
      if (query.text.startsWith('delete from "jp_grammar"'))
        throw new Error("simulated failure")
      return { rows: [] }
    })
    await expect(seedOpenJlpt(await loadOpenJlpt("/fixture"))).rejects.toThrow()
    const queries = mocks.query.mock.calls.map(([query]) => query.text)
    expect(queries.at(-1)).toBe("rollback")
    expect(queries).not.toContain("commit")
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it("splits large inputs into 500-row inserts", async () => {
    const data = await loadOpenJlpt("/fixture")
    const first = data.vocab[0]
    if (!first) throw new Error("Missing fixture vocabulary")
    data.vocab = Array.from({ length: 501 }, (_, index) => ({
      ...first,
      id: index.toString(16).padStart(10, "0")
    }))
    await seedOpenJlpt(data)
    const inserts = mocks.query.mock.calls.filter(([query]) =>
      query.text.startsWith('insert into "jp_vocab"')
    )
    expect(inserts).toHaveLength(2)
    expect(inserts[0]?.[1].length).toBe(500 * (inserts[1]?.[1].length ?? 0))
  })
})
