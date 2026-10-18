import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { isDeepStrictEqual, parseArgs } from "node:util"

import { parse } from "dotenv"
import pg from "pg"
import { z } from "zod"

import type { CleanData } from "./clean-moji"
import { planImport } from "./import-moji"
import type { VocabRow } from "./import-moji"

const sourceRow = z
  .object({ id: z.string(), lang: z.enum(["ja", "zh-CN"]) })
  .strict()
const sense = z
  .object({
    sourceId: z.string(),
    detailId: z.string(),
    meaningsJa: z.array(z.string()),
    meaningsZh: z.array(z.string()),
    sourceRows: z.array(sourceRow)
  })
  .strict()
const example = z
  .object({
    sourceId: z.string(),
    senseId: z.string(),
    sourceIndex: z.number().int().nonnegative().nullable(),
    ja: z.string().min(1),
    zh: z.string().min(1).nullable(),
    en: z.null(),
    furigana: z.string().nullable(),
    annotationStatus: z.enum([
      "converted",
      "plain",
      "fallback",
      "conflict",
      "missing"
    ]),
    sourceRows: z.array(sourceRow),
    position: z.number().int().nonnegative()
  })
  .strict()
const preparedSchema = z
  .object({
    formatVersion: z.literal(1),
    source: z.literal("moji"),
    collectionId: z.string(),
    entries: z.array(
      z
        .object({
          sourceId: z.string(),
          word: z.string(),
          reading: z.string(),
          posGroups: z.array(
            z
              .object({
                objectId: z.string(),
                wordId: z.string(),
                partOfSpeech: z.array(z.number()).nullable().optional(),
                jita: z.number().nullable().optional(),
                katuyou: z.number().nullable().optional()
              })
              .strict()
          ),
          senses: z.array(sense),
          examples: z.array(example),
          review: z.array(z.unknown()),
          issues: z.array(z.unknown())
        })
        .strict()
    )
  })
  .strict()
export type PreparedDetails = z.infer<typeof preparedSchema>
type DbVocab = VocabRow & Record<string, unknown>
export interface ExampleRow {
  id?: number
  vocab_id: string
  position: number
  ja: string
  en: string | null
  zh?: string | null
  furigana: string | null
  tatoeba_id: number | null
  source?: string
  source_id?: string | null
  source_details?: unknown
}
const digest = (text: string) => createHash("sha256").update(text).digest("hex")
const whitespace = /\s+/gu
const furiganaPattern = /\{([^|}]+)\|([^}]+)\}/gu
const normalize = (text: string) =>
  text.normalize("NFKC").replace(whitespace, "")

export function detailPlan(
  list: CleanData,
  data: PreparedDetails,
  version: string,
  vocab: DbVocab[],
  existingExamples: ExampleRow[]
) {
  assert.equal(data.collectionId, list.collection.id)
  assert.deepEqual(
    data.entries.map((e) => e.sourceId),
    list.entries.map((e) => e.sourceDetails.moji?.entryId)
  )
  assert.equal(
    new Set(data.entries.map((e) => e.sourceId)).size,
    data.entries.length
  )
  const words = planImport(list, vocab).map((change, index) => {
    const detail = data.entries[index]
    assert.ok(detail, "Missing prepared entry")
    assert.equal(normalize(detail.word), normalize(change.entry.word))
    assert.equal(normalize(detail.reading), normalize(change.entry.reading))
    assert.equal(
      new Set(detail.senses.map((s) => s.sourceId)).size,
      detail.senses.length
    )
    const moji = change.after.source_details.moji
    assert.ok(moji, "Missing MOJi provenance")
    const after = {
      ...change.after,
      source_details: {
        ...change.after.source_details,
        moji: {
          ...moji,
          detail: {
            sourceVersion: version,
            senses: detail.senses,
            posGroups: detail.posGroups
          }
        }
      }
    }
    const before = vocab.find((v) => v.id === after.id)
    const unchanged =
      before &&
      Object.entries(after).every(([key, value]) =>
        isDeepStrictEqual(before[key], value)
      )
    let kind = before ? "update" : "insert"
    if (unchanged) kind = "unchanged"
    return {
      ...change,
      after,
      kind
    }
  })
  const inserts: ExampleRow[] = []
  let unchangedExamples = 0
  for (const [index, entry] of data.entries.entries()) {
    const word = words[index]
    assert.ok(word, "Missing vocabulary plan")
    const vocabId = word.after.id
    const prior = existingExamples.filter((e) => e.vocab_id === vocabId)
    let nextPosition = Math.max(-1, ...prior.map((e) => e.position)) + 1
    const seen = new Set<string>()
    for (const item of entry.examples) {
      assert.ok(
        !seen.has(item.sourceId),
        `Duplicate source example ${entry.sourceId}/${item.sourceId}`
      )
      seen.add(item.sourceId)
      assert.ok(
        entry.senses.some((s) => s.sourceId === item.senseId),
        "Missing sense parent"
      )
      if (item.furigana)
        assert.equal(
          item.furigana.replace(furiganaPattern, "$1"),
          item.ja,
          "Furigana surface mismatch"
        )
      const matches = prior.filter(
        (e) => e.source === "moji" && e.source_id === item.sourceId
      )
      assert.ok(matches.length <= 1, "Duplicate database source example")
      const match = matches[0]
      const after: ExampleRow = {
        vocab_id: vocabId,
        position: match?.position ?? nextPosition,
        ja: item.ja,
        en: item.en,
        zh: item.zh,
        furigana: item.furigana,
        tatoeba_id: null,
        source: "moji",
        source_id: item.sourceId,
        source_details: {
          moji: {
            wordId: entry.sourceId,
            senseId: item.senseId,
            sourceIndex: item.sourceIndex,
            sourceRows: item.sourceRows,
            sourceVersion: version
          }
        }
      }
      if (match) {
        assert.ok(
          Object.entries(after).every(([key, value]) =>
            isDeepStrictEqual(match[key as keyof ExampleRow], value)
          ),
          `Existing MOJi example differs: ${vocabId}/${item.sourceId}`
        )
        unchangedExamples++
      } else {
        inserts.push(after)
        nextPosition++
      }
    }
  }
  return {
    words,
    inserts,
    summary: {
      insertedWords: words.filter((w) => w.kind === "insert").length,
      updatedWords: words.filter((w) => w.kind === "update").length,
      unchangedWords: words.filter((w) => w.kind === "unchanged").length,
      insertedExamples: inserts.length,
      unchangedExamples
    }
  }
}

export async function loadInput(directory: string, listPath: string) {
  const bytes = await readFile(
    resolve(directory, "prepared-details.json"),
    "utf-8"
  )
  const report = JSON.parse(
    await readFile(resolve(directory, "report.json"), "utf-8")
  ) as { outputSha256: string; cleanedListSha256: string }
  assert.equal(digest(bytes), report.outputSha256, "Prepared data hash changed")
  const listBytes = await readFile(listPath, "utf-8")
  assert.equal(
    digest(listBytes),
    report.cleanedListSha256,
    "List data hash changed"
  )
  return {
    data: preparedSchema.parse(JSON.parse(bytes)),
    list: JSON.parse(listBytes) as CleanData,
    version: digest(bytes)
  }
}

export async function syncDetails(
  input: Awaited<ReturnType<typeof loadInput>>,
  connectionString: string,
  apply: boolean,
  auditPath: string,
  expectedTarget: string
) {
  const url = new URL(connectionString)
  const identity = digest(
    url.hostname + url.port + url.pathname + url.username
  ).slice(0, 16)
  assert.equal(
    identity,
    expectedTarget,
    "Database target does not match the reviewed target"
  )
  const target = {
    host: url.hostname,
    port: url.port,
    database: url.pathname,
    identity
  }
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 8000
  })
  await client.connect()
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY")
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SET LOCAL statement_timeout = '30s'")
    if (apply)
      await client.query(
        "LOCK TABLE public.jp_vocab, public.jp_vocab_examples IN SHARE ROW EXCLUSIVE MODE"
      )
    const beforeVocabResult = await client.query<DbVocab>(
      "SELECT * FROM public.jp_vocab ORDER BY id"
    )
    const beforeVocab = beforeVocabResult.rows
    const beforeExamplesResult = await client.query<ExampleRow>(
      "SELECT * FROM public.jp_vocab_examples ORDER BY id"
    )
    const beforeExamples = beforeExamplesResult.rows
    const plan = detailPlan(
      input.list,
      input.data,
      input.version,
      beforeVocab,
      beforeExamples
    )
    const modified = plan.words.filter((w) => w.kind !== "unchanged")
    const before = modified.map((w) => ({
      id: w.after.id,
      row: beforeVocab.find((v) => v.id === w.after.id) ?? null
    }))
    await writeFile(
      auditPath,
      JSON.stringify(
        {
          status: apply ? "prepared; see committed sidecar" : "preview",
          target,
          version: input.version,
          summary: plan.summary,
          before,
          after: modified.map((w) => w.after),
          exampleInserts: plan.inserts,
          existingExamplesSha256: digest(JSON.stringify(beforeExamples))
        },
        null,
        2
      ),
      { flag: "wx", mode: 0o600 }
    )
    if (!apply) {
      await client.query("ROLLBACK")
      return { target, ...plan.summary }
    }
    const newWords = modified
      .filter((w) => w.kind === "insert")
      .map((w) => ({
        ...w.after,
        word: w.entry.word,
        reading: w.entry.reading,
        romaji: w.entry.romaji,
        meanings_en: [],
        level: w.entry.level,
        source: "moji",
        source_version: input.list.sourceVersion
      }))
    if (newWords.length)
      await client.query(
        `INSERT INTO public.jp_vocab (id,word,reading,romaji,meanings_en,meanings_zh,meanings_ja,pitch_accents,source_details,level,source,source_version)
      SELECT id,word,reading,romaji,meanings_en,meanings_zh,meanings_ja,pitch_accents,source_details,level,source,source_version
      FROM jsonb_to_recordset($1::jsonb) AS x(id text,word text,reading text,romaji text,meanings_en jsonb,meanings_zh jsonb,meanings_ja jsonb,pitch_accents jsonb,source_details jsonb,level text,source text,source_version text)`,
        [JSON.stringify(newWords)]
      )
    const updates = modified
      .filter((w) => w.kind === "update")
      .map((w) => w.after)
    if (updates.length)
      await client.query(
        `UPDATE public.jp_vocab AS v SET meanings_zh=x.meanings_zh,meanings_ja=x.meanings_ja,pitch_accents=x.pitch_accents,source_details=x.source_details,updated_at=now()
      FROM jsonb_to_recordset($1::jsonb) AS x(id text,meanings_zh jsonb,meanings_ja jsonb,pitch_accents jsonb,source_details jsonb) WHERE v.id=x.id`,
        [JSON.stringify(updates)]
      )
    if (plan.inserts.length)
      await client.query(
        `INSERT INTO public.jp_vocab_examples (vocab_id,position,ja,en,zh,furigana,tatoeba_id,source,source_id,source_details)
      SELECT vocab_id,position,ja,en,zh,furigana,tatoeba_id,source,source_id,source_details
      FROM jsonb_to_recordset($1::jsonb) AS x(vocab_id text,position integer,ja text,en text,zh text,furigana text,tatoeba_id integer,source text,source_id text,source_details jsonb)`,
        [JSON.stringify(plan.inserts)]
      )
    const afterVocabResult = await client.query<DbVocab>(
      "SELECT * FROM public.jp_vocab ORDER BY id"
    )
    const afterVocab = afterVocabResult.rows
    const afterExamplesResult = await client.query<ExampleRow>(
      "SELECT * FROM public.jp_vocab_examples ORDER BY id"
    )
    const afterExamples = afterExamplesResult.rows
    const verified = detailPlan(
      input.list,
      input.data,
      input.version,
      afterVocab,
      afterExamples
    )
    assert.equal(
      verified.summary.insertedWords +
        verified.summary.updatedWords +
        verified.summary.insertedExamples,
      0,
      "Readback is not idempotent"
    )
    assert.equal(afterVocab.length, beforeVocab.length + newWords.length)
    assert.equal(
      afterExamples.length,
      beforeExamples.length + plan.inserts.length
    )
    const changedIds = new Set(modified.map((w) => w.after.id))
    const mutable = new Set([
      "meanings_zh",
      "meanings_ja",
      "pitch_accents",
      "source_details",
      "updated_at"
    ])
    for (const row of beforeVocab) {
      const after = afterVocab.find((v) => v.id === row.id)
      assert.ok(after, "Original word disappeared")
      for (const [key, value] of Object.entries(row))
        if (!changedIds.has(row.id) || !mutable.has(key))
          assert.deepEqual(
            after[key],
            value,
            `Original vocabulary changed: ${row.id}/${key}`
          )
    }
    const oldExampleIds = new Set(beforeExamples.map((e) => e.id))
    assert.deepEqual(
      afterExamples.filter((e) => oldExampleIds.has(e.id)),
      beforeExamples,
      "Original examples changed"
    )
    const afterRows = modified.map((w) =>
      afterVocab.find((v) => v.id === w.after.id)
    )
    const insertedExamples = afterExamples.filter(
      (e) => !oldExampleIds.has(e.id)
    )
    await writeFile(
      `${auditPath}.verified.json`,
      JSON.stringify(
        {
          target,
          summary: plan.summary,
          afterRows,
          insertedExamples,
          verification: verified.summary,
          originalExamplesPreserved: true,
          originalVocabularyCorePreserved: true
        },
        null,
        2
      ),
      { flag: "wx", mode: 0o600 }
    )
    await client.query("COMMIT")
    await writeFile(
      `${auditPath}.committed.json`,
      JSON.stringify({
        target,
        committedAt: new Date().toISOString(),
        summary: plan.summary
      }),
      { flag: "wx", mode: 0o600 }
    )
    return {
      target,
      ...plan.summary,
      verification: verified.summary,
      originalExamplesPreserved: true,
      originalVocabularyCorePreserved: true
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      list: { type: "string" },
      "database-env": { type: "string" },
      "expected-target": { type: "string" },
      audit: { type: "string" },
      apply: { type: "boolean" }
    }
  })
  assert.ok(
    values.input &&
      values.list &&
      values["database-env"] &&
      values.audit &&
      values["expected-target"],
    "input, list, database-env, expected-target and audit are required"
  )
  const input = await loadInput(resolve(values.input), resolve(values.list))
  const env = parse(await readFile(resolve(values["database-env"])))
  const url = env.DATABASE_URL || env.SUPABASE_DB_URL
  assert.ok(url, "Explicit environment file has no database URL")
  const result = await syncDetails(
    input,
    url,
    Boolean(values.apply),
    resolve(values.audit),
    values["expected-target"]
  )
  process.stdout.write(
    `${values.apply ? "Committed" : "Preview"}: ${JSON.stringify(result)}\n`
  )
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Import failed"}\n`
    )
    process.exitCode = 1
  })
}
