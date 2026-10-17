/**
 * Verify pinned OpenJLPT files, then atomically synchronize the built-in word bank.
 * Contains data from OpenJLPT (CC BY-SA 4.0), which uses JMdict and KANJIDIC2 (EDRDG), Jonathan Waller's JLPT lists, and Tatoeba.
 * Attribution is required. To bump the pin, update the commit, version, and every
 * SHA-256 in data/openjlpt.lock.json, then run --dry-run before seeding.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

import { and, eq, inArray, notInArray, sql } from "drizzle-orm"
import { z } from "zod"

import {
  jpGrammar,
  jpKanji,
  jpVocab,
  jpVocabExamples
} from "../src/schema/japanese"

const packageDir = fileURLToPath(new URL("../", import.meta.url))
const levels = ["N5", "N4", "N3", "N2", "N1"] as const
const levelSchema = z.enum(levels)
const strings = z.array(z.string())
const exampleSchema = z.object({
  ja: z.string(),
  furigana: z.string().optional(),
  en: z.string()
})
const vocabSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{10}$/),
  word: z.string().min(1),
  reading: z.string().min(1),
  romaji: z.string(),
  meanings: strings,
  level: levelSchema,
  pos: strings.default([]),
  jmdict_id: z.int().optional(),
  other_forms: strings.default([]),
  other_readings: strings.default([]),
  examples: z
    .array(exampleSchema.extend({ tatoeba_id: z.int().optional() }))
    .default([])
})
const kanjiSchema = z.object({
  character: z.string().min(1),
  level: levelSchema,
  strokes: z.int().nullable(),
  grade: z.int().nullable(),
  freq: z.int().nullable(),
  radical: z.string().nullable(),
  radical_number: z.int().nullable(),
  onyomi: strings,
  kunyomi: strings,
  meanings: strings,
  nanori: strings.default([]),
  words: strings.default([]),
  supplementary: z.boolean().default(false)
})
const grammarSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  reading: z.string().optional(),
  romaji: z.string(),
  level: levelSchema,
  meaning: z.string(),
  formation: z.string(),
  examples: z.array(exampleSchema),
  tags: strings,
  notes: z.string().optional()
})
const lockSchema = z.object({
  repo: z.literal("evanclan/OpenJLPT"),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  version: z.string().min(1),
  license: z.literal("CC-BY-SA-4.0"),
  files: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/))
})

interface OpenJlptData {
  version: string
  vocab: z.infer<typeof vocabSchema>[]
  kanji: z.infer<typeof kanjiSchema>[]
  grammar: z.infer<typeof grammarSchema>[]
}

async function readIfPresent(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined
    }
    throw error
  }
}

function verifyHash(bytes: Buffer, path: string, expected: string): void {
  const actual = createHash("sha256").update(bytes).digest("hex")
  if (actual !== expected) {
    throw new Error(
      `SHA-256 mismatch for ${path}: expected ${expected}, got ${actual}`
    )
  }
}

async function readSourceFile(
  lock: z.infer<typeof lockSchema>,
  path: string,
  expected: string,
  sourceDir?: string
): Promise<Buffer> {
  if (sourceDir) {
    const bytes =
      (await readIfPresent(join(sourceDir, path))) ??
      (await readFile(join(sourceDir, path.slice("data/json/".length))))
    verifyHash(bytes, path, expected)
    return bytes
  }

  const cachePath = join(packageDir, ".cache/openjlpt", lock.commit, path)
  const cached = await readIfPresent(cachePath)
  if (cached) {
    verifyHash(cached, path, expected)
    return cached
  }
  const response = await fetch(
    `https://raw.githubusercontent.com/${lock.repo}/${lock.commit}/${path}`,
    { signal: AbortSignal.timeout(30_000) }
  )
  if (!response.ok) {
    throw new Error(`Download failed for ${path}: HTTP ${response.status}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  verifyHash(bytes, path, expected)
  await mkdir(dirname(cachePath), { recursive: true })
  await writeFile(cachePath, bytes)
  return bytes
}

function parseFile<T>(
  files: Map<string, Buffer>,
  path: string,
  schema: z.ZodType<T>
): T {
  const bytes = files.get(path)
  if (!bytes) throw new Error(`Missing verified file: ${path}`)
  try {
    return schema.parse(JSON.parse(bytes.toString("utf-8")))
  } catch (error) {
    throw new Error(`Invalid OpenJLPT data in ${path}: ${String(error)}`, {
      cause: error
    })
  }
}

function requireUnique(keys: string[], table: string): void {
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`Duplicate ${table} key: ${key}`)
    seen.add(key)
  }
}

export async function loadOpenJlpt(sourceDir?: string): Promise<OpenJlptData> {
  const lock = lockSchema.parse(
    JSON.parse(
      await readFile(join(packageDir, "data/openjlpt.lock.json"), "utf-8")
    )
  )
  const paths = ["data/json/meta.json"]
  for (const kind of ["vocab", "kanji", "grammar"]) {
    for (const level of levels)
      paths.push(`data/json/${kind}/${level.toLowerCase()}.json`)
  }
  if (Object.keys(lock.files).length !== paths.length) {
    throw new Error(
      "OpenJLPT lock must contain meta.json and all 15 level files"
    )
  }
  const files = new Map<string, Buffer>()
  for (const path of paths) {
    const expected = lock.files[path]
    if (!expected) throw new Error(`Missing SHA-256 in lock for ${path}`)
    files.set(path, await readSourceFile(lock, path, expected, sourceDir))
  }
  process.stdout.write(`SHA-256 OK: ${files.size} files (${lock.commit})\n`)

  parseFile(
    files,
    "data/json/meta.json",
    z.object({
      name: z.literal("OpenJLPT"),
      version: z.literal(lock.version),
      license: z.literal(lock.license)
    })
  )
  const data: OpenJlptData = {
    version: lock.version,
    vocab: [],
    kanji: [],
    grammar: []
  }
  for (const level of levels) {
    const filename = `${level.toLowerCase()}.json`
    // Reject empty or mislabelled files before stale-row deletion is possible.
    data.vocab.push(
      ...parseFile(
        files,
        `data/json/vocab/${filename}`,
        z.array(vocabSchema.extend({ level: z.literal(level) })).min(1)
      )
    )
    data.kanji.push(
      ...parseFile(
        files,
        `data/json/kanji/${filename}`,
        z.array(kanjiSchema.extend({ level: z.literal(level) })).min(1)
      )
    )
    data.grammar.push(
      ...parseFile(
        files,
        `data/json/grammar/${filename}`,
        z.array(grammarSchema.extend({ level: z.literal(level) })).min(1)
      )
    )
  }
  requireUnique(
    data.vocab.map((row) => row.id),
    "jp_vocab"
  )
  requireUnique(
    data.kanji.map((row) => row.character),
    "jp_kanji"
  )
  requireUnique(
    data.grammar.map((row) => row.id),
    "jp_grammar"
  )
  return data
}

function* batches<T>(rows: T[]): Generator<T[]> {
  const batchSize = 500
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    yield rows.slice(offset, offset + batchSize)
  }
}

export async function seedOpenJlpt(data: OpenJlptData): Promise<void> {
  // This function is reached only after every file has passed verification.
  // Keep environment loading and pool creation out of the dry-run path.
  await import("dotenv/config")
  const connectionString = process.env.DATABASE_URL
  if (!connectionString)
    throw new Error("DATABASE_URL is required unless --dry-run is used")
  const { drizzle } = await import("drizzle-orm/node-postgres")
  const { default: pg } = await import("pg")
  const pool = new pg.Pool({ connectionString })
  try {
    const db = drizzle(pool)
    await db.transaction(async (tx) => {
      for (const batch of batches(data.vocab)) {
        await tx
          .insert(jpVocab)
          .values(
            batch.map((row) => ({
              id: row.id,
              word: row.word,
              reading: row.reading,
              romaji: row.romaji,
              meaningsEn: row.meanings,
              level: row.level,
              jmdictPos: row.pos,
              jmdictId: row.jmdict_id ?? null,
              otherForms: row.other_forms,
              otherReadings: row.other_readings,
              source: "openjlpt",
              sourceVersion: data.version
            }))
          )
          .onConflictDoUpdate({
            target: jpVocab.id,
            // meaningsZh belongs to later enrichment and must survive a reseed.
            set: {
              word: sql`excluded.word`,
              reading: sql`excluded.reading`,
              romaji: sql`excluded.romaji`,
              meaningsEn: sql`excluded.meanings_en`,
              level: sql`excluded.level`,
              jmdictPos: sql`excluded.jmdict_pos`,
              jmdictId: sql`excluded.jmdict_id`,
              otherForms: sql`excluded.other_forms`,
              otherReadings: sql`excluded.other_readings`,
              source: sql`excluded.source`,
              sourceVersion: sql`excluded.source_version`,
              updatedAt: sql`now()`
            }
          })
      }
      for (const batch of batches(data.vocab)) {
        await tx.delete(jpVocabExamples).where(
          inArray(
            jpVocabExamples.vocabId,
            batch.map((row) => row.id)
          )
        )
        const examples = batch.flatMap((row) =>
          row.examples.map((example, position) => ({
            vocabId: row.id,
            position,
            ja: example.ja,
            en: example.en,
            furigana: example.furigana ?? null,
            tatoebaId: example.tatoeba_id ?? null
          }))
        )
        for (const exampleBatch of batches(examples)) {
          await tx.insert(jpVocabExamples).values(exampleBatch)
        }
      }
      for (const batch of batches(data.kanji)) {
        await tx
          .insert(jpKanji)
          .values(
            batch.map((row) => ({
              character: row.character,
              level: row.level,
              strokes: row.strokes,
              grade: row.grade,
              freq: row.freq,
              radical: row.radical,
              radicalNumber: row.radical_number,
              onyomi: row.onyomi,
              kunyomi: row.kunyomi,
              nanori: row.nanori,
              meaningsEn: row.meanings,
              words: row.words,
              supplementary: row.supplementary,
              sourceVersion: data.version
            }))
          )
          .onConflictDoUpdate({
            target: jpKanji.character,
            set: {
              level: sql`excluded.level`,
              strokes: sql`excluded.strokes`,
              grade: sql`excluded.grade`,
              freq: sql`excluded.freq`,
              radical: sql`excluded.radical`,
              radicalNumber: sql`excluded.radical_number`,
              onyomi: sql`excluded.onyomi`,
              kunyomi: sql`excluded.kunyomi`,
              nanori: sql`excluded.nanori`,
              meaningsEn: sql`excluded.meanings_en`,
              words: sql`excluded.words`,
              supplementary: sql`excluded.supplementary`,
              sourceVersion: sql`excluded.source_version`,
              updatedAt: sql`now()`
            }
          })
      }
      for (const batch of batches(data.grammar)) {
        await tx
          .insert(jpGrammar)
          .values(
            batch.map((row) => ({
              id: row.id,
              pattern: row.pattern,
              reading: row.reading ?? null,
              romaji: row.romaji,
              level: row.level,
              meaning: row.meaning,
              formation: row.formation,
              examples: row.examples,
              tags: row.tags,
              notes: row.notes ?? null,
              sourceVersion: data.version
            }))
          )
          .onConflictDoUpdate({
            target: jpGrammar.id,
            set: {
              pattern: sql`excluded.pattern`,
              reading: sql`excluded.reading`,
              romaji: sql`excluded.romaji`,
              level: sql`excluded.level`,
              meaning: sql`excluded.meaning`,
              formation: sql`excluded.formation`,
              examples: sql`excluded.examples`,
              tags: sql`excluded.tags`,
              notes: sql`excluded.notes`,
              sourceVersion: sql`excluded.source_version`,
              updatedAt: sql`now()`
            }
          })
      }
      // Other sources are not owned by this importer; vocab examples cascade.
      await tx.delete(jpVocab).where(
        and(
          eq(jpVocab.source, "openjlpt"),
          notInArray(
            jpVocab.id,
            data.vocab.map((row) => row.id)
          )
        )
      )
      await tx.delete(jpKanji).where(
        notInArray(
          jpKanji.character,
          data.kanji.map((row) => row.character)
        )
      )
      await tx.delete(jpGrammar).where(
        notInArray(
          jpGrammar.id,
          data.grammar.map((row) => row.id)
        )
      )
    })
  } finally {
    await pool.end()
  }
}

export async function main(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean" },
      "source-dir": { type: "string" }
    },
    strict: true,
    allowPositionals: false
  })
  const data = await loadOpenJlpt(values["source-dir"])
  if (!values["dry-run"]) await seedOpenJlpt(data)
  const exampleCount = data.vocab.reduce(
    (count, row) => count + row.examples.length,
    0
  )
  process.stdout.write(
    [
      values["dry-run"]
        ? "Dry run: validated; no database connection."
        : "Seed committed.",
      `jp_vocab: ${data.vocab.length}`,
      `jp_vocab_examples: ${exampleCount}`,
      `jp_kanji: ${data.kanji.length}`,
      `jp_grammar: ${data.grammar.length}`,
      ""
    ].join("\n")
  )
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    )
    process.exitCode = 1
  })
}
