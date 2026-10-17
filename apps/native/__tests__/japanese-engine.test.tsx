/* eslint-disable max-classes-per-file -- File and Directory model the two Expo filesystem types. */
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"

const disk = vi.hoisted(() => ({
  files: new Map<string, { size: number; md5: string }>(),
  dirs: new Set<string>(),
  download: vi.fn()
}))
vi.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  deleteItemAsync: async () => undefined
}))
vi.mock("@folionote/japanese/kuromoji-dict", () => ({
  KUROMOJI_DICT_FILES: ["base.dat.gz"],
  trimmedFileName: () => "base.dat"
}))
vi.mock("@folionote/japanese/kuromoji", () => ({
  createKuromojiEngine: vi.fn()
}))
vi.mock("expo-file-system", () => {
  const path = (parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === "string" ? part : part.uri)).join("/")
  class File {
    uri: string
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = path(parts)
    }
    get exists() {
      return disk.files.has(this.uri)
    }
    get size() {
      return disk.files.get(this.uri)?.size ?? 0
    }
    get md5() {
      return disk.files.get(this.uri)?.md5 ?? null
    }
    delete() {
      disk.files.delete(this.uri)
    }
    async write(_text: string) {
      disk.files.set(this.uri, { size: 1, md5: "manifest" })
    }
    static async downloadFileAsync(url: string, file: File) {
      disk.download(url)
      disk.files.set(file.uri, { size: 3, md5: "valid" })
    }
  }
  class Directory {
    uri: string
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = path(parts)
    }
    get exists() {
      return disk.dirs.has(this.uri)
    }
    create() {
      disk.dirs.add("docs/japanese-dict")
      disk.dirs.add(this.uri)
    }
    list() {
      return [...disk.dirs]
        .filter((name) => name.startsWith(`${this.uri}/`))
        .map((name) => new Directory(name))
    }
    delete() {
      for (const name of disk.files.keys())
        if (name.startsWith(this.uri)) disk.files.delete(name)
      disk.dirs.delete(this.uri)
    }
  }
  return {
    File,
    Directory,
    Paths: {
      document: "docs",
      basename: (uri: string) => uri.split("/").at(-1)
    }
  }
})

beforeEach(() => {
  vi.resetModules()
  disk.files.clear()
  disk.dirs.clear()
  disk.download.mockReset()
  disk.dirs.add("docs/japanese-dict")
  disk.dirs.add("docs/japanese-dict/v1")
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        version: "v1",
        files: {
          "base.dat": {
            bytes: 3,
            gzipBytes: 2,
            md5: "valid",
            sha256: "unused"
          }
        }
      })
    )
  )
})
afterEach(() => vi.unstubAllGlobals())

it("deletes a same-size corrupt file and downloads it on retry", async () => {
  disk.files.set("docs/japanese-dict/v1/base.dat", { size: 3, md5: "corrupt" })
  const engine = await import("../lib/japanese/on-device-engine")
  await expect(engine.downloadDictionary()).rejects.toThrow("checksum mismatch")
  expect(disk.files.has("docs/japanese-dict/v1/base.dat")).toBe(false)
  expect(disk.download).not.toHaveBeenCalled()
  expect(engine.getOnDeviceEngineState()).toMatchObject({
    status: "error",
    hasCachedFiles: true
  })
  await engine.downloadDictionary()
  expect(disk.download).toHaveBeenCalledOnce()
  expect(engine.getOnDeviceEngineState().dictionary?.version).toBe("v1")
})

it("exposes incomplete cached files after restart and removes them", async () => {
  disk.files.set("docs/japanese-dict/v1/base.dat", { size: 1, md5: "partial" })
  const engine = await import("../lib/japanese/on-device-engine")
  await engine.initOnDeviceEngine()
  expect(engine.getOnDeviceEngineState()).toMatchObject({
    hasCachedFiles: true,
    dictionary: null
  })
  await engine.removeOnDeviceDictionary()
  expect(engine.getOnDeviceEngineState().hasCachedFiles).toBe(false)
  expect(disk.files.size).toBe(0)
})
