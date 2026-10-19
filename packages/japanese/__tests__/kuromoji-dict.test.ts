import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gunzipSync } from "node:zlib"

import * as kuromoji from "@patdx/kuromoji"
import NodeDictionaryLoader from "@patdx/kuromoji/node"
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test"

import type { TokenizerEngine } from "../src/index"
import { createKuromojiEngine } from "../src/kuromoji"
import {
  KUROMOJI_DICT_FILES,
  trimKuromojiDictionary
} from "../src/kuromoji-dict"
import {
  createNodeDictionaryLoader,
  resolveKuromojiDictDir
} from "../src/loaders/node"

const DICTIONARY_LOAD_TIMEOUT_MS = 60_000

// Fixture sentences plus text that exercises unknown words, symbols, Latin,
// numbers and rare kanji, where a wrong target map or trimmed table would
// change the lattice.
const fixtureDir = new URL("fixtures/", import.meta.url)
const texts = [
  ...readdirSync(fixtureDir)
    .filter((name) => name.endsWith(".json"))
    .map(
      (name) =>
        (
          JSON.parse(readFileSync(new URL(name, fixtureDir), "utf-8")) as {
            text: string
          }
        ).text
    ),
  "遠方から行き違いになった友人が、弄った時計を直してくれた。",
  "ｶﾀｶﾅとＡＢＣ、①②③、𠮷野家で牛丼を３杯食べた。",
  "ヴィクトリアズ・シークレットのセールは二〇二六年十月十七日まで！",
  "彼は「もう二度と来ない」と言い残して、颯爽と去っていった……。",
  "鬱蒼とした森の奥に、薔薇と躑躅が咲き乱れていた。"
]

let dictDir: string
let stock: Awaited<ReturnType<kuromoji.TokenizerBuilder["build"]>>
let compact: TokenizerEngine

beforeAll(async () => {
  const source = resolveKuromojiDictDir()
  const files = new Map(
    KUROMOJI_DICT_FILES.map((name) => [
      name,
      new Uint8Array(gunzipSync(readFileSync(join(source, name))))
    ])
  )
  dictDir = mkdtempSync(join(tmpdir(), "folionote-kuromoji-"))
  for (const [name, bytes] of trimKuromojiDictionary(files)) {
    writeFileSync(join(dictDir, name), bytes)
  }

  stock = await new kuromoji.TokenizerBuilder({
    loader: new NodeDictionaryLoader({ dic_path: `${source}/` })
  }).build()
  compact = await createKuromojiEngine({
    loader: createNodeDictionaryLoader(dictDir)
  })
}, DICTIONARY_LOAD_TIMEOUT_MS)

afterAll(() => {
  rmSync(dictDir, { force: true, recursive: true })
})

describe("trimmed dictionary + compact target map", () => {
  it("writes raw files that are much smaller than the decompressed stock files", () => {
    const names = readdirSync(dictDir)
    expect(names.toSorted()).toEqual(
      KUROMOJI_DICT_FILES.map((name) => name.replace(/\.gz$/, "")).toSorted()
    )
    const total = names.reduce(
      (sum, name) => sum + readFileSync(join(dictDir, name)).byteLength,
      0
    )
    // Stock files decompress to ~95.6 MiB; the trimmed set is ~56 MiB.
    expect(total).toBeLessThan(70 * 1024 * 1024)
  })

  it("tokenizes exactly like stock kuromoji", async () => {
    for (const text of texts) {
      const expected = stock.tokenize(text).map((token) => ({
        baseForm: token.basic_form,
        pos: [
          token.pos,
          token.pos_detail_1,
          token.pos_detail_2,
          token.pos_detail_3
        ].join(","),
        reading: token.reading,
        surface: token.surface_form
      }))
      const morphemes = await compact.tokenize(text)
      const actual = morphemes.map((morpheme) => ({
        baseForm: morpheme.baseForm ?? "*",
        pos: [morpheme.pos, ...morpheme.posDetail, "*", "*", "*"]
          .slice(0, 4)
          .join(","),
        reading: morpheme.reading ?? "*",
        surface: morpheme.surface
      }))
      expect(actual, text).toEqual(
        expected.map((token) => ({
          ...token,
          baseForm: token.baseForm || "*",
          reading: token.reading || "*"
        }))
      )
    }
  })
})
