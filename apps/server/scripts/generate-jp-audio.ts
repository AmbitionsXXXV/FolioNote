// Pre-generates pronunciations for the built-in Japanese word bank with Google
// Cloud Text-to-Speech and stores them in the public jp-audio bucket. Study
// cards play these files and fall back to the device voice for anything
// without one (the reader's own list entries, or rows not generated yet).
//
//   vp run jp:audio -- --dry-run            count characters, call nothing
//   vp run jp:audio -- --sample 20          write 20 words + examples to ./jp-audio-sample to listen to
//   vp run jp:audio -- --limit 500          generate and upload 500 of each kind
//   vp run jp:audio                         generate everything still missing
//
// Needs GOOGLE_TTS_API_KEY, DATABASE_URL and the S3_* storage variables, read
// from apps/server/.env (set DOTENV_CONFIG_PATH for production). Rows that
// already have an audio_path are skipped, so an interrupted run resumes.
// Before uploading for the paid app, confirm the Google Cloud terms allow
// storing and redistributing the generated audio.
import "dotenv/config"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"

import { db, jpVocab, jpVocabExamples } from "@folionote/db"
import { uploadJpAudio } from "@folionote/storage"
import { asc, eq, isNull, sql } from "drizzle-orm"

const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
const DEFAULT_VOICE = "ja-JP-Neural2-B"
const CONCURRENCY = 4
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 2000

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    sample: { type: "string" },
    limit: { type: "string" },
    voice: {
      type: "string",
      default: process.env.JP_TTS_VOICE ?? DEFAULT_VOICE
    },
    "words-only": { type: "boolean", default: false }
  }
})

const voice = args.voice ?? DEFAULT_VOICE
const sampleSize = args.sample === undefined ? null : Number(args.sample)
const limit = args.limit === undefined ? null : Number(args.limit)

interface Job {
  kind: "word" | "example"
  id: string
  text: string
}

/** The path a file is stored under; the voice is part of it so a new voice never overwrites. */
const audioPath = (job: Job) =>
  `${job.kind === "word" ? "words" : "examples"}/${voice}/${job.id}.mp3`

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

async function synthesize(text: string, apiKey: string): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(SYNTHESIZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "ja-JP", name: voice },
        audioConfig: { audioEncoding: "MP3" }
      })
    })
    if (response.ok) {
      const body = (await response.json()) as { audioContent?: string }
      if (!body.audioContent) throw new Error(`No audio returned for "${text}"`)
      return Buffer.from(body.audioContent, "base64")
    }
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(
        `Text-to-Speech failed (${response.status}) for "${text}": ${await response.text()}`
      )
    }
    await sleep(RETRY_DELAY_MS * attempt)
  }
}

async function loadJobs(): Promise<Job[]> {
  const rowLimit = sampleSize ?? limit
  const wordsQuery = db
    .select({ id: jpVocab.id, text: jpVocab.reading })
    .from(jpVocab)
    .where(isNull(jpVocab.audioPath))
    .orderBy(asc(jpVocab.level), asc(jpVocab.id))
  const words = await (rowLimit === null
    ? wordsQuery
    : wordsQuery.limit(rowLimit))
  const jobs: Job[] = words.map((row) => ({ kind: "word", ...row }))
  if (args["words-only"]) return jobs

  const examplesQuery = db
    .select({
      id: sql<string>`${jpVocabExamples.id}::text`,
      text: jpVocabExamples.ja
    })
    .from(jpVocabExamples)
    .where(isNull(jpVocabExamples.audioPath))
    .orderBy(asc(jpVocabExamples.vocabId), asc(jpVocabExamples.position))
  const examples = await (rowLimit === null
    ? examplesQuery
    : examplesQuery.limit(rowLimit))
  return [
    ...jobs,
    ...examples.map((row) => ({ kind: "example" as const, ...row }))
  ]
}

async function saveJob(job: Job, audio: Uint8Array, sampleDir: string | null) {
  const path = audioPath(job)
  if (sampleDir !== null) {
    const file = join(sampleDir, path)
    await mkdir(join(file, ".."), { recursive: true })
    await writeFile(file, audio)
    return
  }
  await uploadJpAudio(path, audio)
  if (job.kind === "word") {
    await db
      .update(jpVocab)
      .set({ audioPath: path })
      .where(eq(jpVocab.id, job.id))
  } else {
    await db
      .update(jpVocabExamples)
      .set({ audioPath: path })
      .where(eq(jpVocabExamples.id, Number(job.id)))
  }
}

async function main() {
  const jobs = await loadJobs()
  const characters = jobs.reduce((sum, job) => sum + job.text.length, 0)
  console.log(
    `${jobs.length} files to generate (${characters.toLocaleString()} characters) with ${voice}`
  )
  if (args["dry-run"] || jobs.length === 0) return

  const apiKey = process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY is not set")
  const sampleDir =
    sampleSize === null ? null : join(process.cwd(), "jp-audio-sample")

  let next = 0
  let done = 0
  const failures: string[] = []
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next] as Job
      next += 1
      try {
        await saveJob(job, await synthesize(job.text, apiKey), sampleDir)
      } catch (error) {
        failures.push(`${job.kind} ${job.id}: ${(error as Error).message}`)
      }
      done += 1
      if (done % 100 === 0) console.log(`${done} / ${jobs.length}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log(
    sampleDir === null
      ? `Uploaded ${done - failures.length} files to the jp-audio bucket.`
      : `Wrote ${done - failures.length} files to ${sampleDir}.`
  )
  if (failures.length > 0) {
    console.error(`${failures.length} failed:\n${failures.join("\n")}`)
    process.exitCode = 1
  }
}

await main()
process.exit()
