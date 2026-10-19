import { webcrypto } from "node:crypto"

import {
  KUROMOJI_DICT_FILES,
  trimmedFileName
} from "@folionote/japanese/kuromoji-dict"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"

const stub = vi.hoisted(() => ({
  build: vi.fn(),
  load: vi.fn(),
  prune: vi.fn()
}))
vi.mock("@folionote/japanese/kuromoji", () => ({
  createKuromojiEngine: stub.build
}))
vi.mock("@folionote/japanese", () => ({
  createAnalyzer: () => ({ analyze: vi.fn() }),
  JapaneseAnalyzerError: class extends Error {}
}))
vi.mock("@folionote/japanese/loaders/web", () => ({
  createWebDictionaryLoader: () => ({ loadArrayBuffer: stub.load }),
  webDictionaryCacheName: (version: string) => `dict-${version}`,
  pruneWebDictionaryCaches: stub.prune
}))

const bytes = new Uint8Array([1, 2, 3]).buffer
let handle: (event: {
  data: { type: string; id: number; baseUrl: string }
}) => void
let post: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.resetModules()
  stub.load.mockReset().mockResolvedValue(bytes)
  stub.build.mockReset().mockResolvedValue({})
  stub.prune.mockReset().mockResolvedValue(undefined)
  post = vi.fn()
  vi.stubGlobal("self", {
    addEventListener: (_name: string, listener: typeof handle) => {
      handle = listener
    },
    postMessage: post
  })
  vi.stubGlobal("crypto", webcrypto)
  const sha256 = Buffer.from(
    await webcrypto.subtle.digest("SHA-256", bytes)
  ).toString("hex")
  const files = Object.fromEntries(
    KUROMOJI_DICT_FILES.map((name) => [
      trimmedFileName(name),
      { bytes: 3, sha256 }
    ])
  )
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ version: "new", files }))
  )
  await import("../src/lib/japanese/japanese-analyzer.worker")
})
afterEach(() => vi.unstubAllGlobals())

it.each(["download", "checksum", "build"])(
  "retains old dictionaries when %s fails",
  async (failure) => {
    if (failure === "download")
      stub.load.mockRejectedValue(new Error("offline"))
    if (failure === "checksum")
      stub.load.mockResolvedValue(new Uint8Array([3, 2, 1]).buffer)
    if (failure === "build")
      stub.build.mockRejectedValue(new Error("bad dictionary"))
    handle({
      data: { type: "start", id: 1, baseUrl: "https://example.com/dict/" }
    })
    await vi.waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ type: "failed" })
      )
    )
    expect(stub.prune).not.toHaveBeenCalled()
  }
)

it("prunes only after every checksum and the engine build succeed", async () => {
  let finish!: (engine: object) => void
  stub.build.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  handle({
    data: { type: "start", id: 1, baseUrl: "https://example.com/dict/" }
  })
  await vi.waitFor(() => expect(stub.build).toHaveBeenCalledOnce())
  expect(stub.load).toHaveBeenCalledTimes(KUROMOJI_DICT_FILES.length)
  expect(stub.prune).not.toHaveBeenCalled()
  finish({})
  await vi.waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: "started" })
    )
  )
  expect(stub.prune).toHaveBeenCalledWith("dict-new")
})
