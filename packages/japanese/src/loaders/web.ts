import type { DictionaryLoader } from "./types"

export interface WebDictionaryLoaderOptions {
  /** Directory URL with a trailing slash; files are fetched as `${baseUrl}${fileName(name)}`. */
  baseUrl: string
  /** Bump when the dictionary version changes; entries are never revalidated. */
  cacheName?: string
  /**
   * Maps the names kuromoji asks for (`base.dat.gz`) to the names the server
   * serves (`base.dat` for the trimmed files). Defaults to identity.
   */
  fileName?: (name: string) => string
  /** Decompressed bytes received so far for a file still downloading. */
  onProgress?: (name: string, loadedBytes: number) => void
  /** A file finished loading; `fromCache` is false when it came off the network. */
  onFileLoaded?: (name: string, bytes: number, fromCache: boolean) => void
}

/** Every dictionary cache this loader creates starts with this prefix. */
export const WEB_DICTIONARY_CACHE_PREFIX = "folionote-kuromoji-dict-"
const DEFAULT_CACHE_NAME = `${WEB_DICTIONARY_CACHE_PREFIX}default`
const GZIP_MAGIC = [0x1f, 0x8b] as const

/** Cache name for one served dictionary version (the manifest's content hash). */
export const webDictionaryCacheName = (version: string): string =>
  `${WEB_DICTIONARY_CACHE_PREFIX}${version}`

const identity = (name: string): string => name

function isGzip(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  return head[0] === GZIP_MAGIC[0] && head[1] === GZIP_MAGIC[1]
}

async function gunzipBytes(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
  return await new Response(stream).arrayBuffer()
}

// Cache Storage is missing in some contexts (insecure origins, some workers,
// private modes), so every access degrades to "no cache" instead of failing.
async function openCache(cacheName: string): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null
    return await caches.open(cacheName)
  } catch {
    return null
  }
}

async function readCached(
  cache: Cache | null,
  url: string
): Promise<ArrayBuffer | null> {
  if (!cache) return null
  try {
    const hit = await cache.match(url)
    return hit ? await hit.arrayBuffer() : null
  } catch {
    return null
  }
}

async function writeCached(
  cache: Cache | null,
  url: string,
  bytes: ArrayBuffer
): Promise<void> {
  if (!cache) return
  try {
    await cache.put(url, new Response(bytes))
  } catch {
    // Quota or storage errors only cost a re-download next time.
  }
}

/**
 * Reads the body chunk by chunk so a caller can show progress. The browser has
 * already decoded `Content-Encoding: gzip`, so the counted bytes are raw bytes.
 */
async function readBody(
  response: Response,
  onProgress: ((loadedBytes: number) => void) | undefined
): Promise<ArrayBuffer> {
  if (!(onProgress && response.body)) return await response.arrayBuffer()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded)
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

export function createWebDictionaryLoader({
  baseUrl,
  cacheName = DEFAULT_CACHE_NAME,
  fileName = identity,
  onProgress,
  onFileLoaded
}: WebDictionaryLoaderOptions): DictionaryLoader {
  return {
    async loadArrayBuffer(name) {
      const url = `${baseUrl}${fileName(name)}`
      const cache = await openCache(cacheName)
      const cached = await readCached(cache, url)
      if (cached) {
        onFileLoaded?.(name, cached.byteLength, true)
        return cached
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(
          `Failed to fetch kuromoji dictionary file ${url}: HTTP ${response.status}`
        )
      }
      const raw = await readBody(
        response,
        onProgress ? (loaded) => onProgress(name, loaded) : undefined
      )
      // A server that sends Content-Encoding: gzip has already been decoded
      // by the browser; gunzipping twice would throw.
      const bytes = isGzip(raw) ? await gunzipBytes(raw) : raw
      await writeCached(cache, url, bytes)
      onFileLoaded?.(name, bytes.byteLength, false)
      return bytes
    }
  }
}

async function dictionaryCacheNames(): Promise<string[]> {
  try {
    if (typeof caches === "undefined") return []
    const names = await caches.keys()
    return names.filter((name) => name.startsWith(WEB_DICTIONARY_CACHE_PREFIX))
  } catch {
    return []
  }
}

/** Versions that have a dictionary cache (complete or not). */
export async function listWebDictionaryVersions(): Promise<string[]> {
  const names = await dictionaryCacheNames()
  return names.map((name) => name.slice(WEB_DICTIONARY_CACHE_PREFIX.length))
}

/**
 * Deletes every dictionary cache except `keepCacheName`: when the server
 * moves to a new version, the old one would otherwise sit around forever.
 */
export async function pruneWebDictionaryCaches(
  keepCacheName?: string
): Promise<void> {
  for (const name of await dictionaryCacheNames()) {
    if (name === keepCacheName) continue
    try {
      await caches.delete(name)
    } catch {
      // A cache that cannot be deleted is only wasted space.
    }
  }
}

/** Removes all dictionary caches (the user asked to free the space). */
export const deleteWebDictionaryCaches = (): Promise<void> =>
  pruneWebDictionaryCaches()
