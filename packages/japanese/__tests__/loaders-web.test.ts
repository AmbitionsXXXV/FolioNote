import { gzipSync } from "node:zlib"

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { trimmedFileName } from "../src/kuromoji-dict"
import {
  createWebDictionaryLoader,
  listWebDictionaryVersions,
  pruneWebDictionaryCaches,
  WEB_DICTIONARY_CACHE_PREFIX,
  webDictionaryCacheName
} from "../src/loaders/web"

const BASE_URL = "https://api.example.test/japanese-dict/abc123/"

/** In-memory stand-in for Cache Storage: one Map of stored bodies per cache. */
function fakeCacheStorage() {
  const stores = new Map<string, Map<string, Uint8Array>>()
  const open = vi.fn(async (name: string) => {
    let store = stores.get(name)
    if (!store) {
      store = new Map()
      stores.set(name, store)
    }
    const entries = store
    return {
      match: async (url: string) => {
        const hit = entries.get(url)
        return hit ? new Response(hit.slice()) : undefined
      },
      put: async (url: string, response: Response) => {
        entries.set(url, new Uint8Array(await response.arrayBuffer()))
      }
    }
  })
  return {
    stores,
    caches: {
      open,
      keys: async () => [...stores.keys()],
      delete: vi.fn(async (name: string) => stores.delete(name)),
      has: async (name: string) => stores.has(name)
    }
  }
}

const bytesOf = (text: string) => new TextEncoder().encode(text)

/** Streams `body` to the client in `chunkSize` pieces so progress is observable. */
function streamedResponse(body: Uint8Array, chunkSize: number): Response {
  let offset = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= body.byteLength) {
        controller.close()
        return
      }
      controller.enqueue(body.slice(offset, offset + chunkSize))
      offset += chunkSize
    }
  })
  return new Response(stream, { status: 200 })
}

let storage: ReturnType<typeof fakeCacheStorage>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = fakeCacheStorage()
  vi.stubGlobal("caches", storage.caches)
  fetchMock = vi.fn(async (url: string) => {
    const name = url.slice(url.lastIndexOf("/") + 1)
    return new Response(bytesOf(`payload:${name}`), { status: 200 })
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createWebDictionaryLoader", () => {
  it("requests the mapped file name under the base URL and caches it by that URL", async () => {
    const cacheName = webDictionaryCacheName("abc123")
    const loaded: [string, number, boolean][] = []
    const loader = createWebDictionaryLoader({
      baseUrl: BASE_URL,
      cacheName,
      fileName: trimmedFileName,
      onFileLoaded: (name, bytes, fromCache) =>
        loaded.push([name, bytes, fromCache])
    })

    const bytes = await loader.loadArrayBuffer("base.dat.gz")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}base.dat`)
    expect(new TextDecoder().decode(bytes)).toBe("payload:base.dat")
    expect(storage.caches.open).toHaveBeenCalledWith(cacheName)
    expect(
      storage.stores.get(cacheName)?.has(`${BASE_URL}base.dat`)
    ).toBeTruthy()
    expect(loaded).toEqual([["base.dat.gz", bytes.byteLength, false]])
  })

  it("defaults to identity file names", async () => {
    const loader = createWebDictionaryLoader({ baseUrl: BASE_URL })
    await loader.loadArrayBuffer("tid.dat.gz")
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}tid.dat.gz`)
    expect([...storage.stores.keys()]).toEqual([
      `${WEB_DICTIONARY_CACHE_PREFIX}default`
    ])
  })

  it("serves a second request from the cache without fetching", async () => {
    const loaded: boolean[] = []
    const loader = createWebDictionaryLoader({
      baseUrl: BASE_URL,
      cacheName: webDictionaryCacheName("abc123"),
      fileName: trimmedFileName,
      onFileLoaded: (_name, _bytes, fromCache) => loaded.push(fromCache)
    })

    const first = await loader.loadArrayBuffer("check.dat.gz")
    const second = await loader.loadArrayBuffer("check.dat.gz")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new Uint8Array(second)).toEqual(new Uint8Array(first))
    expect(loaded).toEqual([false, true])
  })

  it("keeps separate caches per version so a new version never reads stale files", async () => {
    const v1 = createWebDictionaryLoader({
      baseUrl: "https://api.example.test/japanese-dict/v1/",
      cacheName: webDictionaryCacheName("v1"),
      fileName: trimmedFileName
    })
    const v2 = createWebDictionaryLoader({
      baseUrl: "https://api.example.test/japanese-dict/v2/",
      cacheName: webDictionaryCacheName("v2"),
      fileName: trimmedFileName
    })

    await v1.loadArrayBuffer("unk.dat.gz")
    await v2.loadArrayBuffer("unk.dat.gz")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await listWebDictionaryVersions()).toEqual(["v1", "v2"])
  })

  it("inflates a body the browser did not decode and caches the raw bytes", async () => {
    const raw = bytesOf("raw dictionary bytes")
    fetchMock.mockResolvedValueOnce(
      new Response(gzipSync(raw), { status: 200 })
    )
    const cacheName = webDictionaryCacheName("gz")
    const loader = createWebDictionaryLoader({
      baseUrl: BASE_URL,
      cacheName,
      fileName: trimmedFileName
    })

    const bytes = await loader.loadArrayBuffer("cc.dat.gz")

    expect(new Uint8Array(bytes)).toEqual(raw)
    expect(storage.stores.get(cacheName)?.get(`${BASE_URL}cc.dat`)).toEqual(raw)
  })

  it("reports cumulative decompressed bytes while a file streams in", async () => {
    const body = new Uint8Array(10_000).fill(7)
    fetchMock.mockResolvedValueOnce(streamedResponse(body, 4096))
    const progress: [string, number][] = []
    const loader = createWebDictionaryLoader({
      baseUrl: BASE_URL,
      cacheName: webDictionaryCacheName("abc123"),
      fileName: trimmedFileName,
      onProgress: (name, loaded) => progress.push([name, loaded])
    })

    const bytes = await loader.loadArrayBuffer("tid_map.dat.gz")

    expect(bytes.byteLength).toBe(10_000)
    expect(progress).toEqual([
      ["tid_map.dat.gz", 4096],
      ["tid_map.dat.gz", 8192],
      ["tid_map.dat.gz", 10_000]
    ])
  })

  it("fails loudly on an HTTP error instead of caching it", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    const cacheName = webDictionaryCacheName("abc123")
    const loader = createWebDictionaryLoader({
      baseUrl: BASE_URL,
      cacheName,
      fileName: trimmedFileName
    })

    await expect(loader.loadArrayBuffer("unk_pos.dat.gz")).rejects.toThrow(
      /HTTP 404/
    )
    expect(storage.stores.get(cacheName)?.size ?? 0).toBe(0)
  })

  it("works without Cache Storage", async () => {
    vi.stubGlobal("caches", undefined)
    const loader = createWebDictionaryLoader({
      baseUrl: BASE_URL,
      fileName: trimmedFileName
    })
    await loader.loadArrayBuffer("unk_map.dat.gz")
    await loader.loadArrayBuffer("unk_map.dat.gz")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("pruneWebDictionaryCaches", () => {
  it("deletes other dictionary versions and leaves unrelated caches alone", async () => {
    await storage.caches.open(webDictionaryCacheName("old1"))
    await storage.caches.open(webDictionaryCacheName("old2"))
    await storage.caches.open(webDictionaryCacheName("current"))
    await storage.caches.open("workbox-precache")

    await pruneWebDictionaryCaches(webDictionaryCacheName("current"))

    expect([...storage.stores.keys()].toSorted()).toEqual([
      webDictionaryCacheName("current"),
      "workbox-precache"
    ])
  })

  it("removes every dictionary cache when nothing is kept", async () => {
    await storage.caches.open(webDictionaryCacheName("a"))
    await storage.caches.open(webDictionaryCacheName("b"))
    await storage.caches.open("other")

    await pruneWebDictionaryCaches()

    expect([...storage.stores.keys()]).toEqual(["other"])
    expect(await listWebDictionaryVersions()).toEqual([])
  })
})
