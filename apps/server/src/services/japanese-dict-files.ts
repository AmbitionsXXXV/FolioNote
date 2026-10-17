// Builds the on-disk layout the /japanese-dict route serves: kuromoji's IPADIC
// dictionary trimmed (packages/japanese/src/kuromoji-dict.ts), both raw (used by
// this server's own analyzer) and pre-gzipped (downloaded once by the native
// app), plus a manifest whose version is a content hash of the trimmed set.
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"

import {
  KUROMOJI_DICT_FILES,
  trimKuromojiDictionary,
  trimmedFileName
} from "@folionote/japanese/kuromoji-dict"

export const JAPANESE_DICT_GZ_DIR = "gz"
export const JAPANESE_DICT_MANIFEST = "manifest.json"
/** Bump when the manifest shape or file layout changes, so stale dev dirs rebuild. */
export const JAPANESE_DICT_FORMAT = 2
const VERSION_HEX_LENGTH = 12

/** Names a client may request: the trimmed files, e.g. `base.dat`. */
export const JAPANESE_DICT_SERVED_FILES: ReadonlySet<string> = new Set(
  KUROMOJI_DICT_FILES.map(trimmedFileName)
)

export interface JapaneseDictManifestFile {
  bytes: number
  gzipBytes: number
  /** Hex SHA-256 of the raw (decompressed) bytes; also the route's ETag. */
  sha256: string
  /** Hex MD5 of the raw bytes: what expo-file-system can hash natively. */
  md5: string
}

export interface JapaneseDictManifest {
  format: typeof JAPANESE_DICT_FORMAT
  version: string
  files: Record<string, JapaneseDictManifestFile>
}

const digestHex = (algorithm: "sha256" | "md5", bytes: Uint8Array): string =>
  createHash(algorithm).update(bytes).digest("hex")

/** Deterministic over file names and raw content, independent of gzip output. */
function manifestVersion(files: Record<string, JapaneseDictManifestFile>) {
  const hash = createHash("sha256")
  for (const name of Object.keys(files).toSorted()) {
    hash.update(`${name}:${files[name]?.sha256}\n`)
  }
  return hash.digest("hex").slice(0, VERSION_HEX_LENGTH)
}

export interface PrepareJapaneseDictOptions {
  /** Directory holding the stock `*.dat.gz` files shipped by @patdx/kuromoji. */
  sourceDir: string
  targetDir: string
}

export async function prepareJapaneseDictFiles({
  sourceDir,
  targetDir
}: PrepareJapaneseDictOptions): Promise<JapaneseDictManifest> {
  const stock = new Map<string, Uint8Array>()
  for (const name of KUROMOJI_DICT_FILES) {
    stock.set(name, gunzipSync(await readFile(join(sourceDir, name))))
  }
  const trimmed = trimKuromojiDictionary(stock)

  await mkdir(join(targetDir, JAPANESE_DICT_GZ_DIR), { recursive: true })
  const files: Record<string, JapaneseDictManifestFile> = {}
  for (const [name, content] of trimmed) {
    const gz = gzipSync(content, { level: 9 })
    await writeFile(join(targetDir, name), content)
    await writeFile(join(targetDir, JAPANESE_DICT_GZ_DIR, `${name}.gz`), gz)
    files[name] = {
      bytes: content.byteLength,
      gzipBytes: gz.byteLength,
      sha256: digestHex("sha256", content),
      md5: digestHex("md5", content)
    }
  }
  const manifest: JapaneseDictManifest = {
    format: JAPANESE_DICT_FORMAT,
    version: manifestVersion(files),
    files
  }
  await writeFile(
    join(targetDir, JAPANESE_DICT_MANIFEST),
    JSON.stringify(manifest, null, 2)
  )
  return manifest
}

/** True when `dir` holds a complete set in the current format. */
export function hasJapaneseDictFiles(dir: string): boolean {
  const manifestPath = join(dir, JAPANESE_DICT_MANIFEST)
  if (!existsSync(manifestPath)) return false
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      format?: number
    }
    if (manifest.format !== JAPANESE_DICT_FORMAT) return false
  } catch {
    return false
  }
  for (const name of JAPANESE_DICT_SERVED_FILES) {
    if (!existsSync(join(dir, JAPANESE_DICT_GZ_DIR, `${name}.gz`))) return false
  }
  return true
}

export async function readJapaneseDictManifest(
  dir: string
): Promise<JapaneseDictManifest> {
  const raw = await readFile(join(dir, JAPANESE_DICT_MANIFEST), "utf-8")
  return JSON.parse(raw) as JapaneseDictManifest
}
