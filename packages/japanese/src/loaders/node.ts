import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { gunzipSync } from "node:zlib"

import { trimmedFileName } from "../kuromoji-dict"
import type { DictionaryLoader } from "./types"

/**
 * Locates @patdx/kuromoji's bundled `dict/` from this module, not from cwd.
 * A bundled server (dist/) should pass an explicit dir instead, because the
 * package may not be resolvable next to the bundle.
 */
export function resolveKuromojiDictDir(): string {
  const require = createRequire(import.meta.url)
  // The package exports only build/index.mjs; dict/ sits beside build/.
  const entry = require.resolve("@patdx/kuromoji")
  return join(dirname(entry), "..", "dict")
}

/**
 * Reads a dictionary directory holding either the stock `*.dat.gz` files or
 * the trimmed raw `*.dat` files written by trimKuromojiDictionary (preferred
 * when present: no gunzip and ~280 MB less RSS). gz files are inflated
 * synchronously: kuromoji requests all 12 at once, and parallel async gunzip
 * kept ~119 MB of extra buffers alive.
 */
export function createNodeDictionaryLoader(dictDir?: string): DictionaryLoader {
  const dir = dictDir ?? resolveKuromojiDictDir()
  return {
    async loadArrayBuffer(name) {
      const rawPath = join(dir, trimmedFileName(name))
      const path = existsSync(rawPath) ? rawPath : join(dir, name)
      try {
        const file = await readFile(path)
        const bytes = path === rawPath ? file : gunzipSync(file)
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        )
      } catch (error) {
        throw new Error(`Failed to load kuromoji dictionary file ${path}`, {
          cause: error
        })
      }
    }
  }
}
