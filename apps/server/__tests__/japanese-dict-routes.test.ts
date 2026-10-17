import {
  createReadStream,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"

import { Hono } from "hono"
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test"

import { registerJapaneseDictRoutes } from "../src/routes/japanese-dict"
import {
  JAPANESE_DICT_FORMAT,
  JAPANESE_DICT_GZ_DIR,
  JAPANESE_DICT_MANIFEST,
  JAPANESE_DICT_SERVED_FILES
} from "../src/services/japanese-dict-files"
import type { JapaneseDictManifest } from "../src/services/japanese-dict-files"
import type { App } from "../src/types"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) }
})

const VERSION = "0123456789ab"
const BASE_SHA =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const encoder = new TextEncoder()
const rawBase = encoder.encode("base-dat-bytes")

let dir: string
let app: App

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "japanese-dict-test-"))
  mkdirSync(join(dir, JAPANESE_DICT_GZ_DIR))
  const files: JapaneseDictManifest["files"] = {}
  for (const name of JAPANESE_DICT_SERVED_FILES) {
    const raw = name === "base.dat" ? rawBase : encoder.encode(name)
    const gz = gzipSync(raw)
    writeFileSync(join(dir, name), raw)
    writeFileSync(join(dir, JAPANESE_DICT_GZ_DIR, `${name}.gz`), gz)
    files[name] = {
      bytes: raw.byteLength,
      gzipBytes: gz.byteLength,
      sha256: name === "base.dat" ? BASE_SHA : "b".repeat(64),
      md5: "c".repeat(32)
    }
  }
  const manifest: JapaneseDictManifest = {
    format: JAPANESE_DICT_FORMAT,
    version: VERSION,
    files
  }
  writeFileSync(join(dir, JAPANESE_DICT_MANIFEST), JSON.stringify(manifest))

  app = new Hono() as App
  registerJapaneseDictRoutes(app, { dir })
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("GET /japanese-dict/manifest.json", () => {
  it("serves the manifest with a short cache", async () => {
    const response = await app.request("/japanese-dict/manifest.json")
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300")
    const body = (await response.json()) as JapaneseDictManifest
    expect(body.version).toBe(VERSION)
    expect(Object.keys(body.files)).toHaveLength(12)
    expect(body.files["base.dat"]).toEqual({
      bytes: rawBase.byteLength,
      gzipBytes: expect.any(Number),
      sha256: BASE_SHA,
      md5: "c".repeat(32)
    })
  })
})

describe("GET /japanese-dict/:version/:file", () => {
  it("serves a whitelisted file pre-gzipped with immutable caching", async () => {
    const response = await app.request(`/japanese-dict/${VERSION}/base.dat`, {
      headers: { "Accept-Encoding": "gzip, deflate, br" }
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Encoding")).toBe("gzip")
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream"
    )
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    )
    expect(response.headers.get("Vary")).toBe("Accept-Encoding")
    expect(response.headers.get("ETag")).toBe(`"${BASE_SHA.slice(0, 16)}"`)
    const body = new Uint8Array(await response.arrayBuffer())
    expect(response.headers.get("Content-Length")).toBe(String(body.byteLength))
    expect(new TextDecoder().decode(gunzipSync(body))).toBe("base-dat-bytes")
  })

  it("sends gzip when the client states no Accept-Encoding", async () => {
    const response = await app.request(`/japanese-dict/${VERSION}/tid.dat`)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Encoding")).toBe("gzip")
    await response.arrayBuffer()
  })

  it("serves raw bytes when the client only accepts identity", async () => {
    const response = await app.request(`/japanese-dict/${VERSION}/base.dat`, {
      headers: { "Accept-Encoding": "identity" }
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Encoding")).toBeNull()
    expect(response.headers.get("Content-Length")).toBe(
      String(rawBase.byteLength)
    )
    expect(await response.text()).toBe("base-dat-bytes")
  })

  it("answers 304 to a matching If-None-Match", async () => {
    const response = await app.request(`/japanese-dict/${VERSION}/base.dat`, {
      headers: { "If-None-Match": `"${BASE_SHA.slice(0, 16)}"` }
    })
    expect(response.status).toBe(304)
  })

  it("serves every one of the 12 trimmed names", async () => {
    for (const name of JAPANESE_DICT_SERVED_FILES) {
      const response = await app.request(`/japanese-dict/${VERSION}/${name}`)
      expect(response.status, name).toBe(200)
      await response.arrayBuffer()
    }
  })

  it("rejects names outside the whitelist", async () => {
    for (const name of [
      "base.dat.gz",
      "manifest.json",
      "index.mjs",
      ".env",
      "gz"
    ]) {
      const response = await app.request(`/japanese-dict/${VERSION}/${name}`)
      expect(response.status, name).toBe(404)
    }
  })

  it("rejects path traversal", async () => {
    for (const path of [
      `/japanese-dict/${VERSION}/..%2Fmanifest.json`,
      `/japanese-dict/${VERSION}/%2E%2E/base.dat`,
      `/japanese-dict/..%2F${VERSION}/base.dat`
    ]) {
      const response = await app.request(path)
      expect(response.status, path).toBe(404)
    }
  })

  it("rejects any other version", async () => {
    for (const version of ["ffffffffffff", "latest", "0"]) {
      const response = await app.request(`/japanese-dict/${version}/base.dat`)
      expect(response.status, version).toBe(404)
    }
  })
})

it("appends Accept-Encoding to existing Vary on bodies and 304s", async () => {
  const varied = new Hono() as App
  varied.use("*", async (c, next) => {
    c.header("Vary", "Origin")
    await next()
  })
  registerJapaneseDictRoutes(varied, { dir })
  for (const cached of [false, true]) {
    const response = await varied.request(
      `/japanese-dict/${VERSION}/base.dat`,
      {
        headers: cached ? { "If-None-Match": `"${BASE_SHA.slice(0, 16)}"` } : {}
      }
    )
    expect(response.status).toBe(cached ? 304 : 200)
    expect(response.headers.get("Vary")).toBe("Origin, Accept-Encoding")
    if (!cached) await response.arrayBuffer()
  }
})

it("streams file bodies and opens no stream for a matching ETag", async () => {
  vi.mocked(createReadStream).mockClear()
  const response = await app.request(`/japanese-dict/${VERSION}/base.dat`, {
    headers: { "Accept-Encoding": "identity" }
  })
  expect(createReadStream).toHaveBeenCalledWith(join(dir, "base.dat"))
  expect(await response.text()).toBe("base-dat-bytes")
  vi.mocked(createReadStream).mockClear()
  const cached = await app.request(`/japanese-dict/${VERSION}/base.dat`, {
    headers: { "If-None-Match": `"${BASE_SHA.slice(0, 16)}"` }
  })
  expect(cached.status).toBe(304)
  expect(createReadStream).not.toHaveBeenCalled()
})
