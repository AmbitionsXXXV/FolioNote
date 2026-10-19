import { createReadStream } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"

import { resolveKuromojiDictDir } from "@folionote/japanese/loaders/node"
import { createLogger } from "@folionote/log"

import {
  hasJapaneseDictFiles,
  JAPANESE_DICT_GZ_DIR,
  JAPANESE_DICT_SERVED_FILES,
  prepareJapaneseDictFiles,
  readJapaneseDictManifest
} from "../services/japanese-dict-files"
import type { JapaneseDictManifest } from "../services/japanese-dict-files"
import type { App } from "../types"

const log = createLogger({ prefix: "japanese-dict" })

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
const MANIFEST_CACHE = "public, max-age=300"
const ETAG_HEX_LENGTH = 16

/**
 * The build writes dist/japanese-dict/ next to the packed index.mjs. In dev
 * that folder does not exist, so the files are prepared once into the OS temp
 * dir on first request (a few seconds; logged loudly).
 */
function resolveJapaneseDictDir(): string | null {
  if (process.env.JAPANESE_DICT_DIR) return process.env.JAPANESE_DICT_DIR
  const bundled = fileURLToPath(new URL("japanese-dict/", import.meta.url))
  return hasJapaneseDictFiles(bundled) ? bundled : null
}

async function prepareDevDictDir(): Promise<string> {
  const dir = join(tmpdir(), "folionote-japanese-dict")
  if (hasJapaneseDictFiles(dir)) return dir
  log.warn(
    `dist/japanese-dict is missing (run \`vp run build -F server\`); preparing the trimmed dictionary into ${dir} for this dev session`
  )
  const startedAt = performance.now()
  await prepareJapaneseDictFiles({
    sourceDir: resolveKuromojiDictDir(),
    targetDir: dir
  })
  log.warn(
    `Dev dictionary prepared in ${Math.round(performance.now() - startedAt)}ms`
  )
  return dir
}

interface DictStore {
  dir: string
  manifest: JapaneseDictManifest
}

export interface JapaneseDictRouteOptions {
  /** Prepared directory (tests); defaults to dist/japanese-dict or a dev temp dir. */
  dir?: string
}

const acceptsGzip = (acceptEncoding: string | undefined): boolean =>
  acceptEncoding === undefined ||
  /(^|,)\s*(gzip|\*)\s*(;|,|$)/i.test(acceptEncoding)

/**
 * Public, static, immutable dictionary files for the on-device analyzer
 * (mecab-ipadic data, licensed for redistribution). Only the 12 trimmed file
 * names are served, only under the current content-hash version.
 */
export function registerJapaneseDictRoutes(
  app: App,
  options: JapaneseDictRouteOptions = {}
) {
  let storePromise: Promise<DictStore> | null = null
  const loadStore = (): Promise<DictStore> => {
    storePromise ??= (async () => {
      const dir = options.dir ?? resolveJapaneseDictDir()
      const resolved = dir ?? (await prepareDevDictDir())
      return {
        dir: resolved,
        manifest: await readJapaneseDictManifest(resolved)
      }
    })().catch((error: unknown) => {
      storePromise = null
      throw error
    })
    return storePromise
  }

  app.get("/japanese-dict/manifest.json", async (c) => {
    const { manifest } = await loadStore()
    c.header("Cache-Control", MANIFEST_CACHE)
    return c.json(manifest)
  })

  app.get("/japanese-dict/:version/:file", async (c) => {
    const { version, file } = c.req.param()
    const { dir, manifest } = await loadStore()
    const entry = manifest.files[file]
    if (
      version !== manifest.version ||
      !JAPANESE_DICT_SERVED_FILES.has(file) ||
      !entry
    ) {
      return c.notFound()
    }

    const etag = `"${entry.sha256.slice(0, ETAG_HEX_LENGTH)}"`
    c.header("Cache-Control", IMMUTABLE_CACHE)
    c.header("ETag", etag)
    c.header("Vary", "Accept-Encoding", { append: true })
    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304)
    }

    c.header("Content-Type", "application/octet-stream")
    // Pre-gzipped bytes by default; a client that cannot decode gzip asks with
    // `Accept-Encoding: identity` and gets the raw file instead.
    if (acceptsGzip(c.req.header("Accept-Encoding"))) {
      c.header("Content-Encoding", "gzip")
      c.header("Content-Length", String(entry.gzipBytes))
      return c.body(
        Readable.toWeb(
          createReadStream(join(dir, JAPANESE_DICT_GZ_DIR, `${file}.gz`))
        ) as ReadableStream<Uint8Array>
      )
    }
    c.header("Content-Length", String(entry.bytes))
    return c.body(
      Readable.toWeb(
        createReadStream(join(dir, file))
      ) as ReadableStream<Uint8Array>
    )
  })
}
