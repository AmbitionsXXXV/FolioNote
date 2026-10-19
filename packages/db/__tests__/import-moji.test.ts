import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { cleanMoji, parseAccents } from "../scripts/clean-moji"
import type { CleanData } from "../scripts/clean-moji"
import { importMoji, planImport } from "../scripts/import-moji"
import type { VocabRow } from "../scripts/import-moji"

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  end: vi.fn(),
  connect: vi.fn()
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      connect = mocks.connect
      end = mocks.end
    }
  }
}))

let directory: string
const target = (overrides = {}) => ({
  objectId: "white",
  spell: "白い",
  pron: "しろい",
  excerpt: "[形] 白色；白色；洁白",
  accent: "②⓪",
  romaji_hepburn: "shiroi",
  tags: "N2#N5",
  updatedAt: "2026-10-17T00:00:00.000Z",
  ...overrides
})

async function page(targets = [target()], overrides = {}, filename = "1.json") {
  await writeFile(
    join(directory, filename),
    JSON.stringify({
      result: {
        code: 200,
        fid: "week1",
        pageIndex: 1,
        totalPage: 1,
        size: targets.length,
        "1": [
          {
            email: "private@example.invalid",
            authData: { sessionKey: "secret" }
          }
        ],
        "1000": [{ objectId: "week1", title: "第1週" }],
        result: targets.map((row) => ({ targetId: row.objectId, target: row })),
        ...overrides
      }
    })
  )
}

function existing(data: CleanData): VocabRow {
  const entry = data.entries[0]
  if (!entry) throw new Error("Missing fixture entry")
  return {
    id: "openjlpt-id",
    word: entry.word,
    reading: entry.reading,
    romaji: entry.romaji,
    level: "N4",
    meanings_zh: null,
    other_forms: [],
    source: "openjlpt"
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  directory = await mkdtemp(join(tmpdir(), "folio-moji-test-"))
  mocks.connect.mockResolvedValue({
    query: mocks.query,
    release: mocks.release
  })
  mocks.end.mockResolvedValue(undefined)
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe("MOJi cleaning", () => {
  it("removes account metadata, deduplicates glosses, and decodes multiple pitches", async () => {
    await page()
    const data = await cleanMoji(directory)
    expect(data.entries[0]).toMatchObject({
      meaningsZh: ["白色", "洁白"],
      pitchAccents: [0, 2],
      level: "N5"
    })
    expect(JSON.stringify(data)).not.toMatch(
      /sessionKey|secret|private@example|authData/u
    )
    expect(data.files[0]?.sha256).toHaveLength(64)
  })
  it("normalizes whitespace and derives romaji from kana without losing raw evidence", async () => {
    await page([
      target({
        spell: "専門",
        pron: "せん もん",
        romaji_hepburn: "semmon",
        tags: "N2#N4"
      })
    ])
    const data = await cleanMoji(directory)
    expect(data.entries[0]).toMatchObject({
      reading: "せんもん",
      romaji: "senmon",
      level: "N4",
      sourceDetails: { moji: { reading: "せん もん", romaji: "semmon" } }
    })
  })
  it("separates reviewed Japanese definitions and preserves distinct readings", async () => {
    await page([
      target({
        objectId: "zfJG8FqFbC",
        spell: "店",
        pron: "てん",
        excerpt: "[接尾] 接尾語的に用いる。",
        tags: "",
        accent: ""
      }),
      target({
        objectId: "shop",
        spell: "店",
        pron: "みせ",
        excerpt: "[名] 商店"
      })
    ])
    const data = await cleanMoji(directory)
    expect(data.entries).toHaveLength(2)
    expect(data.entries[0]).toMatchObject({
      meaningsZh: [],
      meaningsJa: ["接尾語的に用いる。"],
      pitchAccents: [],
      level: "N5"
    })
  })
  it("does not misclassify Chinese definitions containing Japanese quotations", async () => {
    await page([target({ excerpt: "[名·サ变] 病，疾病；〈キリスト教〉上帝" })])
    const data = await cleanMoji(directory)
    expect(data.entries[0]?.meaningsJa).toEqual([])
    expect(data.entries[0]?.meaningsZh).toEqual([
      "病，疾病",
      "〈キリスト教〉上帝"
    ])
  })
  it("fails closed on incomplete pages, wrong totals and empty JSON", async () => {
    await page([target()], { totalPage: 2 })
    await expect(cleanMoji(directory)).rejects.toThrow("Incomplete")
    await page([target()], { size: 2 })
    await expect(cleanMoji(directory)).rejects.toThrow("Row count")
    await writeFile(join(directory, "1.json"), "")
    await expect(cleanMoji(directory)).rejects.toThrow("Invalid or empty")
  })
  it("deduplicates identical source entries but rejects conflicting identities", async () => {
    await page([target(), target()])
    const data = await cleanMoji(directory)
    expect(data.entries).toHaveLength(1)
    await page([target(), target({ pron: "しろ" })])
    await expect(cleanMoji(directory)).rejects.toThrow(
      "Conflicting duplicate ID"
    )
    await page([target(), target({ objectId: "different" })])
    await expect(cleanMoji(directory)).rejects.toThrow("Multiple source IDs")
  })
  it("ignores the separate detail sample and rejects unsupported accent data", async () => {
    await page()
    await writeFile(join(directory, "detail-white.json"), "{}")
    const data = await cleanMoji(directory)
    expect(data.files).toHaveLength(1)
    expect(() => parseAccents("②/③")).toThrow("Unsupported")
  })
})

describe("MOJi merge planning", () => {
  it("preserves existing content, levels and identity; repeated plans are no-ops", async () => {
    await page()
    const data = await cleanMoji(directory)
    const before = {
      ...existing(data),
      meanings_zh: ["人工释义"],
      pitch_accents: [1]
    }
    const change = planImport(data, [before])[0]
    if (!change) throw new Error("Missing planned change")
    expect(change.kind).toBe("update")
    expect(change.after).toMatchObject({
      id: "openjlpt-id",
      meanings_zh: ["人工释义"],
      pitch_accents: [1]
    })
    expect(change.after).not.toHaveProperty("level")
    expect(change.after).not.toHaveProperty("meanings_en")
    const after = { ...before, ...change.after }
    // PostgreSQL JSONB reorders object keys.
    const source = change.after.source_details.moji
    if (!source) throw new Error("Missing source evidence")
    const { entryId, ...rest } = source
    after.source_details = { moji: { ...rest, entryId } }
    expect(planImport(data, [after])[0]?.kind).toBe("unchanged")
  })
  it("uses an unambiguous alternate form and refuses ambiguous matches", async () => {
    await page()
    const data = await cleanMoji(directory)
    const alias = { ...existing(data), word: "しろい", other_forms: ["白い"] }
    expect(planImport(data, [alias])[0]?.after.id).toBe(alias.id)
    expect(() => planImport(data, [alias, { ...alias, id: "other" }])).toThrow(
      "Ambiguous"
    )
  })
  it("does not combine homographs or overwrite an existing MOJi identity", async () => {
    await page()
    const data = await cleanMoji(directory)
    expect(
      planImport(data, [{ ...existing(data), reading: "しろ" }])[0]?.kind
    ).toBe("insert")
    expect(() =>
      planImport(data, [
        { ...existing(data), id: "moji:white", reading: "しろ" }
      ])
    ).toThrow("identity changed")
  })
})

describe("MOJi transaction safety", () => {
  it("previews without writing and saves an exclusive before-image audit", async () => {
    await page()
    const data = await cleanMoji(directory)
    const before = existing(data)
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("SELECT") ? [before] : []
    }))
    const audit = join(directory, "audit.json")
    expect(await importMoji(data, "unused", false, audit)).toEqual({
      inserted: 0,
      updated: 1,
      unchanged: 0
    })
    expect(mocks.query.mock.calls.map(([sql]) => sql)).not.toContain("COMMIT")
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        /^(INSERT|UPDATE|DELETE)/u.test(sql)
      )
    ).toBe(false)
    expect(
      JSON.parse(await readFile(audit, "utf-8")).changes[0].before.id
    ).toBe(before.id)
    await expect(importMoji(data, "unused", false, audit)).rejects.toThrow(
      "EEXIST"
    )
  })
  it("rolls back if SQL fails after planning and closes the connection", async () => {
    await page()
    const data = await cleanMoji(directory)
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("INSERT")) throw new Error("simulated insert failure")
      return { rows: [] }
    })
    await expect(
      importMoji(data, "unused", true, join(directory, "audit.json"))
    ).rejects.toThrow("simulated")
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
    expect(mocks.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false)
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(mocks.end).toHaveBeenCalledOnce()
  })
  it("refuses to commit when readback differs from the planned data", async () => {
    await page()
    const data = await cleanMoji(directory)
    mocks.query.mockResolvedValue({ rows: [] })
    await expect(
      importMoji(data, "unused", true, join(directory, "audit.json"))
    ).rejects.toThrow("readback failed")
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
  })
})
