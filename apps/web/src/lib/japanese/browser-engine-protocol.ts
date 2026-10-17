// Message contract between the reading UI (browser-engine.ts) and the Web
// Worker that runs kuromoji (japanese-analyzer.worker.ts). Kept free of engine
// imports so the main bundle never pulls kuromoji in.
import type { AnalyzedText } from "@folionote/japanese"

export interface DictionaryManifestFile {
  bytes: number
  gzipBytes: number
  sha256: string
  md5: string
}

/** GET {serverUrl}/japanese-dict/manifest.json (apps/server/src/routes/japanese-dict.ts). */
export interface DictionaryManifest {
  format: number
  version: string
  files: Record<string, DictionaryManifestFile>
}

export interface CachedDictionary {
  /** The manifest's content-hash version. */
  version: string
  /** Raw (decompressed) bytes of the 12 files. */
  bytes: number
}

export interface BrowserEngineMetrics {
  downloadMs?: number
  verifyMs?: number
  buildMs?: number
  lastAnalyzeMs?: number
  /** Chromium only: performance.memory.usedJSHeapSize in the worker after the build. */
  workerHeapBytes?: number
}

export type EngineWorkerRequestBody =
  | {
      type: "start"
      /** `${serverUrl}/japanese-dict/` with the trailing slash. */
      baseUrl: string
    }
  | { type: "analyze"; text: string }

/** Replies carry the request's id back (progress messages the start's id). */
export type EngineWorkerRequest = EngineWorkerRequestBody & { id: number }

export type EngineWorkerResponse =
  | {
      type: "progress"
      id: number
      phase: "downloading"
      bytes: number
      totalBytes: number
    }
  | { type: "progress"; id: number; phase: "building" }
  | {
      type: "started"
      id: number
      dictionary: CachedDictionary
      metrics: BrowserEngineMetrics
    }
  | { type: "analyzed"; id: number; analysis: AnalyzedText; ms: number }
  | { type: "failed"; id: number; message: string; code: string | null }
