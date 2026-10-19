// On-device Japanese analysis: downloads the trimmed kuromoji dictionary once
// from the API server (GET /japanese-dict/...), keeps it in the app's document
// directory keyed by the server's content-hash version, and builds the same
// analyzer the server runs so AnalyzedText renders through the same views.
import { createAnalyzer } from "@folionote/japanese"
import type { AnalyzedText, JapaneseAnalyzer } from "@folionote/japanese"
import { createKuromojiEngine } from "@folionote/japanese/kuromoji"
import {
  KUROMOJI_DICT_FILES,
  trimmedFileName
} from "@folionote/japanese/kuromoji-dict"
import { Directory, File, Paths } from "expo-file-system"
import * as SecureStore from "expo-secure-store"

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? ""
const DICT_ROOT = "japanese-dict"
const MANIFEST_FILE = "manifest.json"
const CONSENT_KEY = "folio_japanese_on_device_engine"
/** After the server answered SERVICE_UNAVAILABLE, go local directly for a while. */
const SERVER_UNAVAILABLE_WINDOW_MS = 60_000
/** Shown in the consent copy; the gzip transfer size of the 12 files. */
export const DICTIONARY_DOWNLOAD_MB = 17
const GZIP_MAGIC = [0x1f, 0x8b] as const

export type OnDeviceEngineStatus =
  | "idle"
  | "downloading"
  | "verifying"
  | "building"
  | "ready"
  | "error"

export interface CachedDictionary {
  version: string
  bytes: number
}

export interface OnDeviceEngineMetrics {
  downloadMs?: number
  verifyMs?: number
  buildMs?: number
  lastAnalyzeMs?: number
}

export interface OnDeviceEngineState {
  status: OnDeviceEngineStatus
  /** Raw (decompressed) bytes written so far, over the raw total. */
  progress: { bytes: number; totalBytes: number } | null
  error: string | null
  hasCachedFiles: boolean
  dictionary: CachedDictionary | null
  /** null until SecureStore has been read. */
  consent: boolean | null
  metrics: OnDeviceEngineMetrics
}

interface ManifestFile {
  bytes: number
  gzipBytes: number
  sha256: string
  md5: string
}

interface DictManifest {
  version: string
  files: Record<string, ManifestFile>
}

const SERVED_FILES = KUROMOJI_DICT_FILES.map(trimmedFileName)

let state: OnDeviceEngineState = {
  status: "idle",
  progress: null,
  error: null,
  dictionary: null,
  hasCachedFiles: false,
  consent: null,
  metrics: {}
}
const listeners = new Set<() => void>()
let analyzerPromise: Promise<JapaneseAnalyzer> | null = null
let serverUnavailableAt = 0
let initialized = false

function setState(patch: Partial<OnDeviceEngineState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export const getOnDeviceEngineState = (): OnDeviceEngineState => state

export function subscribeOnDeviceEngine(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const dictRoot = () => new Directory(Paths.document, DICT_ROOT)

/** The one fully verified version on disk (its manifest.json is written last). */
function readCachedDictionary(): CachedDictionary | null {
  const root = dictRoot()
  if (!root.exists) return null
  for (const entry of root.list()) {
    if (!(entry instanceof Directory)) continue
    const manifest = new File(entry, MANIFEST_FILE)
    if (!manifest.exists) continue
    let bytes = 0
    for (const name of SERVED_FILES) {
      const file = new File(entry, name)
      if (file.exists) bytes += file.size
    }
    return { version: Paths.basename(entry.uri), bytes }
  }
  return null
}

/** Reads consent and disk state once per app session. */
export async function initOnDeviceEngine(): Promise<void> {
  if (initialized) return
  initialized = true
  let consent = false
  try {
    consent = (await SecureStore.getItemAsync(CONSENT_KEY)) === "true"
  } catch {
    consent = false
  }
  let dictionary: CachedDictionary | null = null
  try {
    dictionary = readCachedDictionary()
    setState({
      hasCachedFiles: dictRoot().exists && dictRoot().list().length > 0
    })
  } catch (error) {
    setState({ error: errorMessage(error) })
  }
  setState({ consent, dictionary })
}

export function markServerUnavailable(): void {
  serverUnavailableAt = Date.now()
}

export const isServerRecentlyUnavailable = (): boolean =>
  Date.now() - serverUnavailableAt < SERVER_UNAVAILABLE_WINDOW_MS

const isManifestFile = (value: unknown): value is ManifestFile =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ManifestFile).bytes === "number" &&
  typeof (value as ManifestFile).gzipBytes === "number" &&
  typeof (value as ManifestFile).md5 === "string"

/**
 * Always revalidated: the manifest is small, and a cached copy from an older
 * server build would point at files whose checksums no longer line up.
 */
async function fetchManifest(): Promise<DictManifest> {
  const response = await fetch(
    `${SERVER_URL}/japanese-dict/manifest.json?t=${Date.now()}`
  )
  if (!response.ok) {
    throw new Error(
      `Dictionary manifest request failed: HTTP ${response.status}`
    )
  }
  const manifest = (await response.json()) as DictManifest
  for (const name of SERVED_FILES) {
    if (!isManifestFile(manifest.files?.[name])) {
      throw new Error(`Dictionary manifest is missing ${name}`)
    }
  }
  return manifest
}

function isGzipFile(file: File): boolean {
  const head = file.bytesSync().subarray(0, 2)
  return head[0] === GZIP_MAGIC[0] && head[1] === GZIP_MAGIC[1]
}

interface DownloadFileOptions {
  url: string
  file: File
  entry: ManifestFile
  signal?: AbortSignal
  onBytes: (bytes: number) => void
}

/**
 * NSURLSession / OkHttp decode `Content-Encoding: gzip` transparently, so the
 * file on disk should already be the raw bytes. If a platform ever stores the
 * gzip body instead, the file is fetched again as identity (the route serves
 * the raw copy for `Accept-Encoding: identity`) rather than inflated in JS.
 */
async function downloadFile({
  url,
  file,
  entry,
  signal,
  onBytes
}: DownloadFileOptions): Promise<void> {
  await File.downloadFileAsync(url, file, {
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten }) =>
      onBytes(Math.min(bytesWritten, entry.bytes))
  })
  if (file.size === entry.bytes) return
  if (file.size === entry.gzipBytes && isGzipFile(file)) {
    await File.downloadFileAsync(url, file, {
      headers: { "Accept-Encoding": "identity" },
      idempotent: true,
      signal,
      onProgress: ({ bytesWritten }) =>
        onBytes(Math.min(bytesWritten, entry.bytes))
    })
    if (file.size === entry.bytes) return
  }
  throw new Error(
    `${Paths.basename(file.uri)}: expected ${entry.bytes} bytes, got ${file.size}`
  )
}

/**
 * expo-file-system hashes natively (MD5 only): ~60 ms for the 36 MB file,
 * where a JS SHA-256 of the whole set took 11 s on Hermes. The manifest
 * carries both digests; the server's ETag is the SHA-256.
 */
function verifyFile(file: File, entry: ManifestFile): void {
  const digest = file.md5
  if (digest === null) {
    throw new Error(
      `${Paths.basename(file.uri)}: this platform cannot hash files, refusing to use an unverified dictionary`
    )
  }
  if (digest !== entry.md5) {
    file.delete()
    throw new Error(`${Paths.basename(file.uri)}: checksum mismatch`)
  }
}

/**
 * Downloads (or resumes) the current dictionary version. Files already on
 * disk with the right size are kept; everything is checksummed before the
 * manifest marks the version complete.
 */
export async function downloadDictionary(signal?: AbortSignal): Promise<void> {
  if (state.status === "downloading" || state.status === "verifying") return
  const startedAt = performance.now()
  try {
    setState({ status: "downloading", error: null, progress: null })
    const manifest = await fetchManifest()
    const dir = new Directory(dictRoot(), manifest.version)
    dir.create({ intermediates: true, idempotent: true })
    setState({ hasCachedFiles: true })

    const totalBytes = SERVED_FILES.reduce(
      (sum, name) => sum + (manifest.files[name]?.bytes ?? 0),
      0
    )
    let completed = 0
    setState({ progress: { bytes: 0, totalBytes } })
    for (const name of SERVED_FILES) {
      const entry = manifest.files[name] as ManifestFile
      const file = new File(dir, name)
      if (!(file.exists && file.size === entry.bytes)) {
        await downloadFile({
          url: `${SERVER_URL}/japanese-dict/${manifest.version}/${name}`,
          file,
          entry,
          signal,
          onBytes: (bytes) =>
            setState({ progress: { bytes: completed + bytes, totalBytes } })
        })
      }
      completed += entry.bytes
      setState({ progress: { bytes: completed, totalBytes } })
    }
    const downloadMs = Math.round(performance.now() - startedAt)

    setState({ status: "verifying" })
    const verifyStartedAt = performance.now()
    for (const name of SERVED_FILES) {
      verifyFile(new File(dir, name), manifest.files[name] as ManifestFile)
    }
    const verifyMs = Math.round(performance.now() - verifyStartedAt)

    // Older versions are replaced; the manifest is written last as the
    // "complete" marker that readCachedDictionary relies on.
    for (const entry of dictRoot().list()) {
      if (entry instanceof Directory && entry.uri !== dir.uri) entry.delete()
    }
    await new File(dir, MANIFEST_FILE).write(JSON.stringify(manifest))
    setState({
      status: "idle",
      progress: null,
      dictionary: { version: manifest.version, bytes: totalBytes },
      metrics: { ...state.metrics, downloadMs, verifyMs }
    })
  } catch (error) {
    setState({ status: "error", progress: null, error: errorMessage(error) })
    throw error
  }
}

async function buildAnalyzer(dictionary: CachedDictionary) {
  // Let the current frame paint before the one-time synchronous build.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0))
  })
  setState({ status: "building", error: null })
  const startedAt = performance.now()
  const dir = new Directory(dictRoot(), dictionary.version)
  const engine = await createKuromojiEngine({
    loader: {
      async loadArrayBuffer(name) {
        // File.bytes() hands back the native buffer directly (no base64).
        const bytes = await new File(dir, trimmedFileName(name)).bytes()
        return bytes.byteOffset === 0 &&
          bytes.byteLength === bytes.buffer.byteLength
          ? bytes.buffer
          : bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength
            )
      }
    }
  })
  const analyzer = createAnalyzer({ engine })
  setState({
    status: "ready",
    metrics: {
      ...state.metrics,
      buildMs: Math.round(performance.now() - startedAt)
    }
  })
  return analyzer
}

/** Builds the analyzer once per app session, after pending interactions. */
export function ensureOnDeviceAnalyzer(): Promise<JapaneseAnalyzer> {
  if (analyzerPromise) return analyzerPromise
  const dictionary = state.dictionary
  if (!dictionary) {
    return Promise.reject(new Error("Dictionary is not downloaded"))
  }
  analyzerPromise = buildAnalyzer(dictionary).catch((error: unknown) => {
    analyzerPromise = null
    setState({ status: "error", error: errorMessage(error) })
    throw error
  })
  return analyzerPromise
}

export async function analyzeOnDevice(text: string): Promise<AnalyzedText> {
  const analyzer = await ensureOnDeviceAnalyzer()
  const startedAt = performance.now()
  const result = await analyzer.analyze(text)
  setState({
    metrics: {
      ...state.metrics,
      lastAnalyzeMs: Math.round((performance.now() - startedAt) * 100) / 100
    }
  })
  return result
}

export const isOnDeviceAnalyzerReady = (): boolean =>
  state.status === "ready" && analyzerPromise !== null

/** Remembers the user's choice, downloads if needed and starts the engine. */
export async function enableOnDeviceEngine(): Promise<void> {
  await SecureStore.setItemAsync(CONSENT_KEY, "true")
  setState({ consent: true })
  if (!state.dictionary) await downloadDictionary()
  await ensureOnDeviceAnalyzer()
}

/** Deletes the cached files and forgets the consent. */
export async function removeOnDeviceDictionary(): Promise<void> {
  const root = dictRoot()
  if (root.exists) root.delete()
  analyzerPromise = null
  try {
    await SecureStore.deleteItemAsync(CONSENT_KEY)
  } catch {
    // Nothing to delete is fine.
  }
  setState({
    status: "idle",
    progress: null,
    error: null,
    dictionary: null,
    hasCachedFiles: false,
    consent: false,
    metrics: {}
  })
}
