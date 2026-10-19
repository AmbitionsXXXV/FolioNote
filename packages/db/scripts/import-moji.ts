import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { isDeepStrictEqual, parseArgs } from "node:util"

import { parse } from "dotenv"
import pg from "pg"

import type { VocabSourceDetails } from "../src/schema/japanese"
import { cleanMoji } from "./clean-moji"
import type { CleanData, CleanEntry } from "./clean-moji"

export interface VocabRow {
  id: string
  word: string
  reading: string
  romaji: string
  level: string
  meanings_zh: string[] | null
  meanings_ja?: string[] | null
  pitch_accents?: number[]
  source_details?: VocabSourceDetails | null
  other_forms: string[]
  source: string
}

interface Change {
  kind: "insert" | "update" | "unchanged"
  entry: CleanEntry
  before: VocabRow | null
  after: {
    id: string
    meanings_zh: string[] | null
    meanings_ja: string[] | null
    pitch_accents: number[]
    source_details: VocabSourceDetails
  }
}

export function planImport(data: CleanData, existing: VocabRow[]): Change[] {
  const used = new Set<string>()
  return data.entries.map((entry) => {
    const sameId = existing.find((row) => row.id === entry.id)
    const exact = existing.filter(
      (row) =>
        row.word.normalize("NFC") === entry.word &&
        row.reading === entry.reading
    )
    const aliases = existing.filter(
      (row) =>
        row.other_forms.includes(entry.word) && row.reading === entry.reading
    )
    if (
      sameId &&
      (sameId.word !== entry.word || sameId.reading !== entry.reading)
    ) {
      throw new Error(`Source identity changed: ${entry.id}`)
    }
    let matches = exact.length > 0 ? exact : aliases
    if (sameId) matches = [sameId]
    if (matches.length > 1)
      throw new Error(
        `Ambiguous database match: ${entry.word}/${entry.reading}`
      )
    const before = matches[0] ?? null
    const id = before?.id ?? entry.id
    if (used.has(id))
      throw new Error(
        `Multiple input entries resolve to ${id}; review before merging`
      )
    used.add(id)
    const priorSource = before?.source_details?.moji
    const sourceMoji = entry.sourceDetails.moji
    if (!sourceMoji) throw new Error(`Missing MOJi provenance: ${entry.id}`)
    if (
      priorSource &&
      priorSource.entryId !== entry.sourceDetails.moji?.entryId
    ) {
      throw new Error(`Conflicting MOJi provenance for ${id}`)
    }
    let meaningsZh = before?.meanings_zh ?? null
    let meaningsJa = before?.meanings_ja ?? null
    if (!meaningsZh?.length && entry.meaningsZh.length)
      meaningsZh = entry.meaningsZh
    if (!meaningsJa?.length && entry.meaningsJa.length)
      meaningsJa = entry.meaningsJa
    const after = {
      id,
      // Existing translations and pronunciation evidence remain authoritative.
      meanings_zh: meaningsZh,
      meanings_ja: meaningsJa,
      pitch_accents: before?.pitch_accents?.length
        ? before.pitch_accents
        : entry.pitchAccents,
      source_details: {
        ...before?.source_details,
        ...entry.sourceDetails,
        moji: { ...priorSource, ...sourceMoji }
      }
    }
    const unchanged =
      before &&
      isDeepStrictEqual(
        {
          id,
          meanings_zh: before.meanings_zh,
          meanings_ja: before.meanings_ja ?? null,
          pitch_accents: before.pitch_accents ?? [],
          source_details: before.source_details
        },
        after
      )
    let kind: Change["kind"] = before ? "update" : "insert"
    if (unchanged) kind = "unchanged"
    return {
      kind,
      entry,
      before,
      after
    }
  })
}

export async function importMoji(
  data: CleanData,
  connectionString: string,
  apply: boolean,
  auditPath: string
): Promise<{ inserted: number; updated: number; unchanged: number }> {
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000
  })
  try {
    const client = await pool.connect()
    try {
      await client.query(apply ? "BEGIN" : "BEGIN READ ONLY")
      await client.query("SET LOCAL lock_timeout = '5s'")
      await client.query("SET LOCAL statement_timeout = '30s'")
      // Serialize the read/merge/write cycle with other seeds, without blocking readers.
      if (apply)
        await client.query(
          "LOCK TABLE public.jp_vocab IN SHARE ROW EXCLUSIVE MODE"
        )
      const words = data.entries.map((entry) => entry.word)
      const ids = data.entries.map((entry) => entry.id)
      const result = await client.query<VocabRow>(
        "SELECT * FROM public.jp_vocab WHERE word = ANY($1::text[]) OR other_forms ?| $1::text[] OR id = ANY($2::text[])",
        [words, ids]
      )
      const changes = planImport(data, result.rows)
      const summary = {
        inserted: changes.filter((change) => change.kind === "insert").length,
        updated: changes.filter((change) => change.kind === "update").length,
        unchanged: changes.filter((change) => change.kind === "unchanged")
          .length
      }
      // Exclusive creation prevents a repeat run from destroying the original before-images.
      await writeFile(
        auditPath,
        `${JSON.stringify(
          {
            status: apply
              ? "prepared; confirm commit in CLI output"
              : "preview; no writes",
            sourceVersion: data.sourceVersion,
            summary,
            changes
          },
          null,
          2
        )}\n`,
        { flag: "wx", mode: 0o600 }
      )
      if (apply) {
        for (const change of changes) {
          const { entry, after } = change
          if (change.kind === "unchanged") continue
          const fields = [
            after.id,
            after.meanings_zh === null
              ? null
              : JSON.stringify(after.meanings_zh),
            after.meanings_ja === null
              ? null
              : JSON.stringify(after.meanings_ja),
            JSON.stringify(after.pitch_accents),
            JSON.stringify(after.source_details)
          ]
          if (change.kind === "update") {
            await client.query(
              `UPDATE public.jp_vocab SET meanings_zh=$2::jsonb, meanings_ja=$3::jsonb,
                pitch_accents=$4::jsonb, source_details=$5::jsonb, updated_at=now() WHERE id=$1`,
              fields
            )
          } else {
            await client.query(
              `INSERT INTO public.jp_vocab
                (id, meanings_zh, meanings_ja, pitch_accents, source_details, word, reading, romaji,
                 meanings_en, level, source, source_version)
                VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7,$8,'[]'::jsonb,$9,'moji',$10)`,
              [
                ...fields,
                entry.word,
                entry.reading,
                entry.romaji,
                entry.level,
                data.sourceVersion
              ]
            )
          }
        }
        // Read back the affected rows before committing; a second plan must be a no-op.
        const verified = await client.query<VocabRow>(
          "SELECT * FROM public.jp_vocab WHERE id = ANY($1::text[])",
          [changes.map((change) => change.after.id)]
        )
        const remaining = planImport(data, verified.rows).filter(
          (change) => change.kind !== "unchanged"
        )
        if (verified.rows.length !== changes.length || remaining.length)
          throw new Error("Import readback failed; rolling back")
      }
      await client.query(apply ? "COMMIT" : "ROLLBACK")
      return summary
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

export async function main(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      input: { type: "string" },
      output: { type: "string" },
      "database-env": { type: "string" },
      audit: { type: "string" },
      apply: { type: "boolean" },
      preview: { type: "boolean" }
    }
  })
  if (!values.input || !values.output)
    throw new Error(
      "Required: --input <page-directory> --output <cleaned.json>"
    )
  if (values.apply && values.preview)
    throw new Error("Choose --preview or --apply")
  const data = await cleanMoji(resolve(values.input))
  const output = resolve(values.output)
  if (dirname(output) === resolve(values.input))
    throw new Error("Write cleaned data outside the raw input directory")
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(data, null, 2)}\n`)
  process.stdout.write(
    `Validated ${data.files.length} pages, ${data.collection.total} source rows, ${data.entries.length} unique entries.\n`
  )
  if (!values.apply && !values.preview) return
  if (!values["database-env"] || !values.audit)
    throw new Error(
      "Database operations require --database-env and a new --audit path"
    )
  // Explicit env file only: never silently fall back from local to production.
  const env = parse(await readFile(resolve(values["database-env"]), "utf-8"))
  if (!env.DATABASE_URL)
    throw new Error("DATABASE_URL missing from selected env file")
  const target = new URL(env.DATABASE_URL)
  process.stdout.write(
    `Database: ${target.hostname}:${target.port || "5432"}${target.pathname}\n`
  )
  const summary = await importMoji(
    data,
    env.DATABASE_URL,
    !!values.apply,
    resolve(values.audit)
  )
  process.stdout.write(
    `${values.apply ? "Committed" : "Preview (no writes)"}: ${JSON.stringify(summary)}\n`
  )
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Import failed"}\n`
    )
    process.exitCode = 1
  })
}
