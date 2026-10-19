// Runs kuromoji off the main thread. Downloads the trimmed IPADIC dictionary
// from the API server once (Cache Storage keeps it, keyed by the manifest's
// content-hash version), builds the same analyzer the server runs and answers
// analyze requests. The only module that imports @folionote/japanese/kuromoji
// in apps/web, so the engine lives in this worker chunk alone.
import { createAnalyzer, JapaneseAnalyzerError } from "@folionote/japanese"
import type { JapaneseAnalyzer } from "@folionote/japanese"
import { createKuromojiEngine } from "@folionote/japanese/kuromoji"
import {
  KUROMOJI_DICT_FILES,
  trimmedFileName
} from "@folionote/japanese/kuromoji-dict"
import {
  createWebDictionaryLoader,
  pruneWebDictionaryCaches,
  webDictionaryCacheName
} from "@folionote/japanese/loaders/web"

import type {
  BrowserEngineMetrics,
  DictionaryManifest,
  DictionaryManifestFile,
  EngineWorkerRequest,
  EngineWorkerResponse
} from "./browser-engine-protocol"

// The web tsconfig uses the DOM lib; this is the slice of the worker scope
// the file needs, instead of pulling in the conflicting webworker lib.
interface WorkerScope {
  postMessage(message: EngineWorkerResponse): void
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<EngineWorkerRequest>) => void
  ): void
}

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number }
}

const scope = self as unknown as WorkerScope
const PROGRESS_INTERVAL_MS = 80
const MANIFEST_FILE = "manifest.json"

// eslint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes no targetOrigin
const post = (message: EngineWorkerResponse): void => scope.postMessage(message)

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const isManifestFile = (value: unknown): value is DictionaryManifestFile =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as DictionaryManifestFile).bytes === "number" &&
  typeof (value as DictionaryManifestFile).sha256 === "string"

/**
 * Always revalidated (`no-cache`): a stale manifest from an older server build
 * would point at a version the route no longer serves.
 */
async function fetchManifest(baseUrl: string): Promise<DictionaryManifest> {
  const response = await fetch(`${baseUrl}${MANIFEST_FILE}`, {
    cache: "no-cache"
  })
  if (!response.ok) {
    throw new Error(
      `Dictionary manifest request failed: HTTP ${response.status}`
    )
  }
  const manifest = (await response.json()) as DictionaryManifest
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("Dictionary manifest has no version")
  }
  for (const name of KUROMOJI_DICT_FILES) {
    if (!isManifestFile(manifest.files?.[trimmedFileName(name)])) {
      throw new Error(`Dictionary manifest is missing ${trimmedFileName(name)}`)
    }
  }
  return manifest
}

const toHex = (digest: ArrayBuffer): string =>
  [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")

/**
 * SHA-256 over the raw bytes, which the manifest carries (the server's ETag
 * is the same digest). Skipped where SubtleCrypto is missing (insecure
 * origins): the byte-length check still catches truncated downloads.
 */
async function verifyFile(
  name: string,
  bytes: ArrayBufferLike,
  entry: DictionaryManifestFile
): Promise<void> {
  if (bytes.byteLength !== entry.bytes) {
    throw new Error(
      `${name}: expected ${entry.bytes} bytes, got ${bytes.byteLength}`
    )
  }
  if (typeof crypto === "undefined" || !crypto.subtle) return
  const digest = toHex(
    await crypto.subtle.digest("SHA-256", new Uint8Array(bytes as ArrayBuffer))
  )
  if (digest !== entry.sha256) {
    throw new Error(`${name}: checksum mismatch`)
  }
}

interface DownloadResult {
  files: Map<string, ArrayBufferLike>
  metrics: Pick<BrowserEngineMetrics, "downloadMs" | "verifyMs">
}

/**
 * Loads the 12 files (Cache Storage first, network otherwise) and verifies
 * each against the manifest. A cached file that fails verification is
 * dropped from the cache and fetched once more before giving up.
 */
async function downloadDictionary(
  id: number,
  baseUrl: string,
  manifest: DictionaryManifest
): Promise<DownloadResult> {
  const versionUrl = `${baseUrl}${manifest.version}/`
  const cacheName = webDictionaryCacheName(manifest.version)

  const entryOf = (name: string): DictionaryManifestFile =>
    manifest.files[trimmedFileName(name)] as DictionaryManifestFile
  let totalBytes = 0
  for (const name of KUROMOJI_DICT_FILES) totalBytes += entryOf(name).bytes

  const loaded = new Map<string, number>()
  const fromCache = new Set<string>()
  let lastProgressAt = 0
  const report = (force: boolean) => {
    const now = performance.now()
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return
    lastProgressAt = now
    let bytes = 0
    for (const value of loaded.values()) bytes += value
    post({
      type: "progress",
      id,
      phase: "downloading",
      bytes: Math.min(bytes, totalBytes),
      totalBytes
    })
  }
  const loader = createWebDictionaryLoader({
    baseUrl: versionUrl,
    cacheName,
    fileName: trimmedFileName,
    onProgress: (name, bytes) => {
      loaded.set(name, bytes)
      report(false)
    },
    onFileLoaded: (name, bytes, cached) => {
      loaded.set(name, bytes)
      if (cached) fromCache.add(name)
      report(true)
    }
  })

  const startedAt = performance.now()
  let verifyMs = 0
  const loadVerified = async (name: string): Promise<ArrayBufferLike> => {
    let bytes = await loader.loadArrayBuffer(name)
    const verifyStartedAt = performance.now()
    try {
      await verifyFile(trimmedFileName(name), bytes, entryOf(name))
    } catch (error) {
      if (!fromCache.has(name)) throw error
      // Evict the bad cache entry and fetch the file again.
      fromCache.delete(name)
      try {
        const cache = await caches.open(cacheName)
        await cache.delete(`${versionUrl}${trimmedFileName(name)}`)
      } catch {
        // If the entry cannot be deleted the re-fetch still returns it; the
        // second verification below then fails loudly.
      }
      bytes = await loader.loadArrayBuffer(name)
      await verifyFile(trimmedFileName(name), bytes, entryOf(name))
    } finally {
      verifyMs += performance.now() - verifyStartedAt
    }
    return bytes
  }

  post({ type: "progress", id, phase: "downloading", bytes: 0, totalBytes })
  // kuromoji itself requests all 12 files at once, so the download does too.
  const files = new Map<string, ArrayBufferLike>()
  await Promise.all(
    KUROMOJI_DICT_FILES.map(async (name) => {
      files.set(name, await loadVerified(name))
    })
  )
  const elapsed = performance.now() - startedAt
  return {
    files,
    metrics: {
      downloadMs: Math.round(elapsed - verifyMs),
      verifyMs: Math.round(verifyMs)
    }
  }
}

let analyzer: JapaneseAnalyzer | null = null

async function start(id: number, baseUrl: string): Promise<JapaneseAnalyzer> {
  const manifest = await fetchManifest(baseUrl)
  const { files, metrics } = await downloadDictionary(id, baseUrl, manifest)
  let totalBytes = 0
  for (const bytes of files.values()) totalBytes += bytes.byteLength

  post({ type: "progress", id, phase: "building" })
  const buildStartedAt = performance.now()
  const engine = await createKuromojiEngine({
    loader: {
      loadArrayBuffer: (name) => {
        const bytes = files.get(name)
        return bytes
          ? Promise.resolve(bytes)
          : Promise.reject(new Error(`Dictionary file ${name} was not loaded`))
      }
    }
  })
  files.clear()
  const built = createAnalyzer({ engine })
  // Without SubtleCrypto the loader only checked lengths; retain older versions.
  if (typeof crypto !== "undefined" && crypto.subtle) {
    await pruneWebDictionaryCaches(webDictionaryCacheName(manifest.version))
  }
  const buildMs = Math.round(performance.now() - buildStartedAt)
  const memory = (performance as PerformanceWithMemory).memory

  post({
    type: "started",
    id,
    dictionary: { version: manifest.version, bytes: totalBytes },
    metrics: {
      ...metrics,
      buildMs,
      ...(memory ? { workerHeapBytes: memory.usedJSHeapSize } : {})
    }
  })
  return built
}

// browser-engine.ts creates a fresh worker per engine lifetime and sends one
// "start" before any "analyze", so no request queueing is needed here.
async function handle(request: EngineWorkerRequest): Promise<void> {
  if (request.type === "start") {
    try {
      analyzer = await start(request.id, request.baseUrl)
    } catch (error) {
      post({
        type: "failed",
        id: request.id,
        message: errorMessage(error),
        code: null
      })
    }
    return
  }

  if (!analyzer) {
    post({
      type: "failed",
      id: request.id,
      message: "The browser engine has not started",
      code: "ENGINE_UNAVAILABLE"
    })
    return
  }
  const startedAt = performance.now()
  try {
    const analysis = await analyzer.analyze(request.text)
    post({
      type: "analyzed",
      id: request.id,
      analysis,
      ms: Math.round((performance.now() - startedAt) * 100) / 100
    })
  } catch (error) {
    post({
      type: "failed",
      id: request.id,
      message: errorMessage(error),
      code: error instanceof JapaneseAnalyzerError ? error.code : null
    })
  }
}

scope.addEventListener("message", (event) => {
  void handle(event.data)
})
