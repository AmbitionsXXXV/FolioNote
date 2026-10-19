// In-browser Japanese analysis: the Web Worker in japanese-analyzer.worker.ts
// downloads the trimmed kuromoji dictionary once from the API server (kept in
// Cache Storage, keyed by the server's content-hash version) and runs the
// same analyzer the server does, so AnalyzedText renders through the same
// views. Mirrors apps/native/lib/japanese/on-device-engine.ts.
import type { AnalyzedText } from "@folionote/japanese"
import {
  deleteWebDictionaryCaches,
  listWebDictionaryVersions
} from "@folionote/japanese/loaders/web"

import { getServerUrl } from "@/utils/api-environment"

import type {
  BrowserEngineMetrics,
  CachedDictionary,
  EngineWorkerRequest,
  EngineWorkerRequestBody,
  EngineWorkerResponse
} from "./browser-engine-protocol"

const CONSENT_KEY = "folionote:japanese-browser-engine:consent"
const DICTIONARY_KEY = "folionote:japanese-browser-engine:dictionary"
/** After the server answered SERVICE_UNAVAILABLE, go local directly for a while. */
const SERVER_UNAVAILABLE_WINDOW_MS = 60_000
/** Shown in the consent copy; the gzip transfer size of the 12 files. */
export const DICTIONARY_DOWNLOAD_MB = 17

export type BrowserEngineStatus =
  | "idle"
  | "downloading"
  | "building"
  | "ready"
  | "error"

export interface BrowserEngineState {
  status: BrowserEngineStatus
  /** Raw (decompressed) bytes received so far, over the raw total. */
  progress: { bytes: number; totalBytes: number } | null
  error: string | null
  /** The complete dictionary in Cache Storage, if any. */
  dictionary: CachedDictionary | null
  /** null until localStorage has been read (on the client). */
  consent: boolean | null
  metrics: BrowserEngineMetrics
}

export class BrowserAnalyzeError extends Error {
  code: string | null

  constructor(message: string, code: string | null) {
    super(message)
    this.name = "BrowserAnalyzeError"
    this.code = code
  }
}

const INITIAL_STATE: BrowserEngineState = {
  status: "idle",
  progress: null,
  error: null,
  dictionary: null,
  consent: null,
  metrics: {}
}

let state: BrowserEngineState = INITIAL_STATE
const listeners = new Set<() => void>()
let initialized = false
let serverUnavailableAt = 0

interface Pending {
  resolve: (response: EngineWorkerResponse) => void
  reject: (error: Error) => void
}

interface EngineConnection {
  worker: Worker
  pending: Map<number, Pending>
  nextId: number
  /** Resolves once the worker has posted "started". */
  started: Promise<void>
}

let connection: EngineConnection | null = null

function setState(patch: Partial<BrowserEngineState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export const getBrowserEngineState = (): BrowserEngineState => state

/** Server snapshot for useSyncExternalStore: nothing is known during SSR. */
export const getBrowserEngineServerState = (): BrowserEngineState =>
  INITIAL_STATE

export function subscribeBrowserEngine(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// localStorage throws in some private modes and is absent during SSR; every
// access degrades to "not remembered".
function readStorage(key: string): string | null {
  try {
    return typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (typeof localStorage === "undefined") return
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // Consent then lasts for this page load only.
  }
}

const isCachedDictionary = (value: unknown): value is CachedDictionary =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CachedDictionary).version === "string" &&
  typeof (value as CachedDictionary).bytes === "number"

/**
 * The dictionary record is written only after a complete, verified download,
 * and counts only while its Cache Storage entry still exists (the browser may
 * evict it under storage pressure).
 */
async function readCachedDictionary(): Promise<CachedDictionary | null> {
  const raw = readStorage(DICTIONARY_KEY)
  if (!raw) return null
  let record: unknown
  try {
    record = JSON.parse(raw)
  } catch {
    writeStorage(DICTIONARY_KEY, null)
    return null
  }
  if (!isCachedDictionary(record)) {
    writeStorage(DICTIONARY_KEY, null)
    return null
  }
  const versions = await listWebDictionaryVersions()
  if (!versions.includes(record.version)) {
    writeStorage(DICTIONARY_KEY, null)
    return null
  }
  return record
}

/** Reads consent and the cached dictionary once per page load (client only). */
export async function initBrowserEngine(): Promise<void> {
  if (initialized || typeof window === "undefined") return
  initialized = true
  const consent = readStorage(CONSENT_KEY) === "true"
  setState({ consent })
  const dictionary = await readCachedDictionary()
  setState({ dictionary })
  if (import.meta.env.DEV) {
    // Dev-tools access, like window.__lastRequestId in utils/orpc.ts.
    ;(
      window as Window & { __japaneseBrowserEngine?: unknown }
    ).__japaneseBrowserEngine = {
      analyze: analyzeInBrowser,
      getState: getBrowserEngineState
    }
  }
}

export function markServerUnavailable(): void {
  serverUnavailableAt = Date.now()
}

export const isServerRecentlyUnavailable = (): boolean =>
  Date.now() - serverUnavailableAt < SERVER_UNAVAILABLE_WINDOW_MS

function failPending(active: EngineConnection, error: Error): void {
  for (const pending of active.pending.values()) pending.reject(error)
  active.pending.clear()
}

function request(
  active: EngineConnection,
  body: EngineWorkerRequestBody
): Promise<EngineWorkerResponse> {
  const id = active.nextId++
  const message: EngineWorkerRequest = { ...body, id }
  return new Promise((resolve, reject) => {
    active.pending.set(id, { resolve, reject })
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage takes no targetOrigin
    active.worker.postMessage(message)
  })
}

function handleResponse(
  active: EngineConnection,
  response: EngineWorkerResponse
): void {
  if (response.type === "progress") {
    if (response.phase === "downloading") {
      setState({
        status: "downloading",
        progress: { bytes: response.bytes, totalBytes: response.totalBytes }
      })
    } else {
      setState({ status: "building", progress: null })
    }
    return
  }
  const pending = active.pending.get(response.id)
  if (!pending) return
  active.pending.delete(response.id)
  pending.resolve(response)
}

/**
 * Spawns the worker and starts the engine: download (or cache hit), verify,
 * build. The module Worker URL is resolved by Vite into its own chunk; the
 * guard keeps SSR and test environments from touching it.
 */
function connect(): EngineConnection {
  if (typeof Worker === "undefined") {
    throw new TypeError("Web Workers are not available in this browser")
  }
  const worker = new Worker(
    new URL("japanese-analyzer.worker.ts", import.meta.url),
    { type: "module" }
  )
  const active: EngineConnection = {
    worker,
    pending: new Map(),
    nextId: 1,
    started: Promise.resolve()
  }
  worker.addEventListener(
    "message",
    (event: MessageEvent<EngineWorkerResponse>) => {
      handleResponse(active, event.data)
    }
  )
  worker.addEventListener("error", (event) => {
    const error = new Error(event.message || "The browser engine crashed")
    failPending(active, error)
    if (connection === active) {
      connection = null
      setState({ status: "error", progress: null, error: error.message })
    }
  })

  setState({ status: "downloading", error: null, progress: null })
  active.started = request(active, {
    type: "start",
    baseUrl: `${getServerUrl()}/japanese-dict/`
  }).then((response) => {
    if (response.type === "failed") {
      throw new BrowserAnalyzeError(response.message, response.code)
    }
    if (response.type !== "started") {
      throw new Error(`Unexpected worker reply ${response.type}`)
    }
    writeStorage(DICTIONARY_KEY, JSON.stringify(response.dictionary))
    setState({
      status: "ready",
      progress: null,
      dictionary: response.dictionary,
      metrics: { ...state.metrics, ...response.metrics }
    })
  })
  return active
}

/** Starts the worker once per page load (or after Remove) and resolves when it is ready. */
export function ensureBrowserAnalyzer(): Promise<void> {
  if (connection) return connection.started
  let active: EngineConnection
  try {
    active = connect()
  } catch (error) {
    setState({ status: "error", progress: null, error: errorMessage(error) })
    return Promise.reject(error)
  }
  connection = active
  return active.started.catch((error: unknown) => {
    if (connection === active) {
      connection = null
      active.worker.terminate()
      setState({ status: "error", progress: null, error: errorMessage(error) })
    }
    throw error
  })
}

export const isBrowserAnalyzerReady = (): boolean =>
  state.status === "ready" && connection !== null

export async function analyzeInBrowser(text: string): Promise<AnalyzedText> {
  await ensureBrowserAnalyzer()
  const active = connection
  if (!active) throw new Error("The browser engine was removed")
  const response = await request(active, { type: "analyze", text })
  if (response.type === "failed") {
    throw new BrowserAnalyzeError(response.message, response.code)
  }
  if (response.type !== "analyzed") {
    throw new Error(`Unexpected worker reply ${response.type}`)
  }
  setState({ metrics: { ...state.metrics, lastAnalyzeMs: response.ms } })
  return response.analysis
}

/** Remembers the user's choice, then downloads (if needed) and starts the engine. */
export async function enableBrowserEngine(): Promise<void> {
  writeStorage(CONSENT_KEY, "true")
  setState({ consent: true })
  await ensureBrowserAnalyzer()
}

/** Stops the worker, deletes the cached files and forgets the consent. */
export async function removeBrowserDictionary(): Promise<void> {
  const active = connection
  connection = null
  if (active) {
    active.worker.terminate()
    failPending(active, new Error("The browser engine was removed"))
  }
  await deleteWebDictionaryCaches()
  writeStorage(DICTIONARY_KEY, null)
  writeStorage(CONSENT_KEY, null)
  setState({
    status: "idle",
    progress: null,
    error: null,
    dictionary: null,
    consent: false,
    metrics: {}
  })
}
