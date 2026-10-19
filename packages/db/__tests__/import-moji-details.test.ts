import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it, vi } from "vite-plus/test"

import type { CleanData } from "../scripts/clean-moji"
import { planImport } from "../scripts/import-moji"
import { detailPlan, syncDetails } from "../scripts/import-moji-details"
import type {
  PreparedDetails,
  ExampleRow
} from "../scripts/import-moji-details"

const database = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn()
}))
vi.mock("pg", () => ({
  default: {
    Client: class {
      connect = database.connect
      query = database.query
      end = database.end
    }
  }
}))

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing fixture")
  return value
}

function fixture() {
  const moji = {
    entryId: "word",
    updatedAt: "2026-10-18T00:00:00.000Z",
    collectionId: "collection",
    collectionTitle: "第1週",
    page: 1,
    position: 1,
    tags: ["N5"],
    partOfSpeech: "名",
    excerpt: "雪",
    reading: "ゆき",
    romaji: "yuki",
    accent: "②"
  }
  const list: CleanData = {
    formatVersion: 1,
    source: "moji",
    sourceVersion: "list-hash",
    collection: {
      id: "collection",
      title: "第1週",
      level: "N5",
      total: 1,
      pages: 1
    },
    files: [],
    issues: [],
    entries: [
      {
        id: "moji:word",
        word: "雪",
        reading: "ゆき",
        romaji: "yuki",
        meaningsEn: [],
        meaningsZh: ["雪"],
        meaningsJa: [],
        pitchAccents: [2],
        level: "N5",
        sourceDetails: { moji }
      }
    ]
  }
  const data: PreparedDetails = {
    formatVersion: 1,
    source: "moji",
    collectionId: "collection",
    entries: [
      {
        sourceId: "word",
        word: "雪",
        reading: "ゆき",
        posGroups: [{ objectId: "pos", wordId: "word", partOfSpeech: [1] }],
        senses: [
          {
            sourceId: "sense",
            detailId: "pos",
            meaningsJa: ["雪"],
            meaningsZh: ["雪"],
            sourceRows: [{ id: "sense", lang: "ja" }]
          }
        ],
        examples: [
          {
            sourceId: "example",
            senseId: "sense",
            sourceIndex: 0,
            ja: "雪です",
            zh: "是雪",
            en: null,
            furigana: "{雪|ゆき}です",
            annotationStatus: "converted",
            position: 0,
            sourceRows: [{ id: "example", lang: "ja" }]
          }
        ],
        review: [],
        issues: []
      }
    ]
  }
  const existing = {
    id: "original-id",
    word: "雪",
    reading: "ゆき",
    romaji: "yuki",
    level: "N4",
    meanings_zh: ["原有译文"],
    meanings_ja: null,
    pitch_accents: [0],
    source_details: { moji },
    other_forms: [],
    source: "openjlpt"
  }
  const examples: ExampleRow[] = [
    {
      id: 1,
      vocab_id: existing.id,
      position: 4,
      ja: "雪です",
      en: "It is snow",
      furigana: null,
      tatoeba_id: 123,
      source: "openjlpt",
      zh: null,
      source_id: null,
      source_details: null
    }
  ]
  return { list, data, existing, examples }
}

describe("MOJi detail import planning", () => {
  it("rolls back a failed readback and retains the before-image audit", async () => {
    const { list, data, existing, examples } = fixture()
    const directory = await mkdtemp(join(tmpdir(), "moji-details-rollback-"))
    const audit = join(directory, "audit.json")
    database.query.mockImplementation((sql: string) => {
      if (sql === "SELECT * FROM public.jp_vocab ORDER BY id")
        return { rows: [existing] }
      if (sql === "SELECT * FROM public.jp_vocab_examples ORDER BY id")
        return { rows: examples }
      return { rows: [] }
    })
    const identity = createHash("sha256")
      .update("localhost5432/testpostgres")
      .digest("hex")
      .slice(0, 16)
    try {
      await expect(
        syncDetails(
          { list, data, version: "v" },
          "postgres://postgres:unused@localhost:5432/test",
          true,
          audit,
          identity
        )
      ).rejects.toThrow("Readback is not idempotent")
      expect(database.query).toHaveBeenCalledWith("ROLLBACK")
      expect(database.query).not.toHaveBeenCalledWith("COMMIT")
      const snapshot = JSON.parse(await readFile(audit, "utf-8"))
      expect(snapshot.before[0].row).toEqual(existing)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
  it("preserves existing vocabulary and examples and appends source-specific examples", () => {
    const { list, data, existing, examples } = fixture()
    const original = structuredClone(examples)
    const plan = detailPlan(list, data, "detail-hash", [existing], examples)
    expect(plan.words[0]?.after).toMatchObject({
      id: "original-id",
      meanings_zh: ["原有译文"],
      pitch_accents: [0]
    })
    expect(plan.inserts[0]).toMatchObject({
      vocab_id: "original-id",
      position: 5,
      en: null,
      zh: "是雪",
      source: "moji",
      source_id: "example",
      tatoeba_id: null
    })
    expect(examples).toEqual(original)
    expect(existing.level).toBe("N4")
  })

  it("has a zero-change second plan, including the nested detail metadata", () => {
    const { list, data, existing, examples } = fixture()
    const plan = detailPlan(list, data, "detail-hash", [existing], examples)
    const enriched = { ...existing, ...required(plan.words[0]).after }
    const repeat = detailPlan(
      list,
      data,
      "detail-hash",
      [enriched],
      [...examples, ...plan.inserts]
    )
    expect(repeat.summary).toEqual({
      insertedWords: 0,
      updatedWords: 0,
      unchangedWords: 1,
      insertedExamples: 0,
      unchangedExamples: 1
    })
    expect(planImport(list, [enriched])[0]?.kind).toBe("unchanged")
  })

  it("uses a unique other-form match without changing the stored spelling", () => {
    const { list, data, existing, examples } = fixture()
    const plan = detailPlan(
      list,
      data,
      "detail-hash",
      [{ ...existing, word: "別表記", other_forms: ["雪"] }],
      examples
    )
    expect(plan.words[0]?.after.id).toBe(existing.id)
    expect(plan.words[0]?.after).not.toHaveProperty("word")
  })

  it("refuses to overwrite a changed imported example", () => {
    const { list, data, existing, examples } = fixture()
    const first = detailPlan(list, data, "detail-hash", [existing], examples)
    const prior = { ...required(first.inserts[0]), zh: "人工修改" }
    expect(() =>
      detailPlan(list, data, "detail-hash", [existing], [...examples, prior])
    ).toThrow("Existing MOJi example differs")
  })

  it("rejects duplicate source examples and missing sense links", () => {
    const { list, data, existing } = fixture()
    required(data.entries[0]).examples.push(
      required(required(data.entries[0]).examples[0])
    )
    expect(() => detailPlan(list, data, "v", [existing], [])).toThrow(
      "Duplicate source example"
    )
    required(data.entries[0]).examples.pop()
    required(required(data.entries[0]).examples[0]).senseId = "missing"
    expect(() => detailPlan(list, data, "v", [existing], [])).toThrow(
      "Missing sense parent"
    )
  })

  it("rejects changed readings and mismatched furigana surfaces", () => {
    const { list, data, existing } = fixture()
    required(data.entries[0]).reading = "せつ"
    expect(() => detailPlan(list, data, "v", [existing], [])).toThrow()
    required(data.entries[0]).reading = "ゆき"
    required(required(data.entries[0]).examples[0]).furigana = "{雨|あめ}です"
    expect(() => detailPlan(list, data, "v", [existing], [])).toThrow(
      "Furigana surface mismatch"
    )
  })

  it("does not import quarantined examples", () => {
    const { list, data, existing } = fixture()
    required(data.entries[0]).review = [
      {
        section: "examples",
        sourceId: "conflict",
        reasons: ["missingSenseParent"]
      }
    ]
    expect(detailPlan(list, data, "v", [existing], []).inserts).toHaveLength(1)
  })
})
