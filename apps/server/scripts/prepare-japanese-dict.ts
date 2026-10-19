// Writes kuromoji's IPADIC dictionary, trimmed, next to the packed server so the
// deployed dist/ (shipped without node_modules) can load it at runtime and
// serve it to the native app (GET /japanese-dict/...). Run with tsx by the
// server's `build` script; the layout is described in
// src/services/japanese-dict-files.ts.
import { join } from "node:path"

import { resolveKuromojiDictDir } from "@folionote/japanese/loaders/node"

import { prepareJapaneseDictFiles } from "../src/services/japanese-dict-files"

const targetDir = join(import.meta.dirname, "..", "dist", "japanese-dict")
const manifest = await prepareJapaneseDictFiles({
  sourceDir: resolveKuromojiDictDir(),
  targetDir
})
let bytes = 0
let gzipBytes = 0
for (const file of Object.values(manifest.files)) {
  bytes += file.bytes
  gzipBytes += file.gzipBytes
}
const mib = (value: number) => (value / 1_048_576).toFixed(1)
console.log(
  `Wrote ${Object.keys(manifest.files).length} trimmed dictionary files (${mib(bytes)} MiB raw, ${mib(gzipBytes)} MiB gzip, version ${manifest.version}) to ${targetDir}`
)
