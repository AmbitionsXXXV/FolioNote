import { readdirSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vite-plus/test"

import { createAnalyzer, JapaneseAnalyzerError } from "../src/index"
import type { RawMorpheme, TokenizerEngine } from "../src/index"
import { createKuromojiEngine } from "../src/kuromoji"

function fakeEngine(
  tokenize: (text: string) => Promise<RawMorpheme[]>
): TokenizerEngine {
  return {
    capabilities: { lemma: true, pos: true, reading: true },
    dictVersion: "test",
    id: "kuromoji-ipadic",
    tokenize
  }
}

const echoEngine = fakeEngine(async (text) => [
  {
    baseForm: text,
    conjugatedForm: null,
    conjugatedType: null,
    end: text.length,
    pos: "名詞",
    posDetail: ["一般"],
    pronunciation: null,
    reading: null,
    start: 0,
    surface: text
  }
])

async function captureError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the promise to reject")
}

describe("error contract", () => {
  it("rejects empty and whitespace-only input", async () => {
    const analyzer = createAnalyzer({ engine: echoEngine })
    for (const text of ["", "   ", "\n\t", "　"]) {
      const error = await captureError(analyzer.analyze(text))
      expect(error).toBeInstanceOf(JapaneseAnalyzerError)
      expect((error as JapaneseAnalyzerError).code).toBe("EMPTY_INPUT")
    }
  })

  it("rejects input longer than maxChars", async () => {
    const analyzer = createAnalyzer({ engine: echoEngine, maxChars: 5 })
    await expect(analyzer.analyze("12345")).resolves.toBeDefined()
    const error = await captureError(analyzer.analyze("123456"))
    expect((error as JapaneseAnalyzerError).code).toBe("INPUT_TOO_LONG")
  })

  it("defaults maxChars to 2000", async () => {
    const analyzer = createAnalyzer({ engine: echoEngine })
    await expect(analyzer.analyze("a".repeat(2000))).resolves.toBeDefined()
    const error = await captureError(analyzer.analyze("a".repeat(2001)))
    expect((error as JapaneseAnalyzerError).code).toBe("INPUT_TOO_LONG")
  })

  it("wraps engine failures as ENGINE_UNAVAILABLE with the cause", async () => {
    const cause = new Error("dictionary exploded")
    const analyzer = createAnalyzer({
      engine: fakeEngine(async () => {
        throw cause
      })
    })
    const error = await captureError(analyzer.analyze("食べる"))
    expect(error).toBeInstanceOf(JapaneseAnalyzerError)
    expect((error as JapaneseAnalyzerError).code).toBe("ENGINE_UNAVAILABLE")
    expect((error as JapaneseAnalyzerError).cause).toBe(cause)
  })

  it("never returns an empty analysis when the engine yields nothing", async () => {
    const analyzer = createAnalyzer({ engine: fakeEngine(async () => []) })
    const error = await captureError(analyzer.analyze("食べる"))
    expect((error as JapaneseAnalyzerError).code).toBe("ENGINE_UNAVAILABLE")
  })

  it("rejects engine offsets that do not match the input", async () => {
    const analyzer = createAnalyzer({
      engine: fakeEngine(async () => [
        {
          baseForm: null,
          conjugatedForm: null,
          conjugatedType: null,
          end: 2,
          pos: "名詞",
          posDetail: [],
          pronunciation: null,
          reading: null,
          start: 0,
          surface: "別物"
        }
      ])
    })
    const error = await captureError(analyzer.analyze("食べる"))
    expect((error as JapaneseAnalyzerError).code).toBe("ENGINE_UNAVAILABLE")
  })

  it("reports a dictionary that fails to load as ENGINE_UNAVAILABLE", async () => {
    const error = await captureError(
      createKuromojiEngine({
        loader: {
          loadArrayBuffer: async (name) => {
            throw new Error(`missing ${name}`)
          }
        }
      })
    )
    expect(error).toBeInstanceOf(JapaneseAnalyzerError)
    expect((error as JapaneseAnalyzerError).code).toBe("ENGINE_UNAVAILABLE")
  })
})

describe("core entry purity", () => {
  // The "." export runs on Hermes, so only the adapter and loaders may touch
  // Node, DOM-only APIs, or the kuromoji engine.
  const PLATFORM_FILES = new Set([
    "kuromoji.ts",
    "loaders/node.ts",
    "loaders/web.ts"
  ])
  const FORBIDDEN_IMPORT =
    /from\s+["'](?:node:[^"']+|fs|zlib|path|@patdx\/kuromoji[^"']*)["']/
  const SRC_DIR = new URL("../src/", import.meta.url)

  it("keeps core files free of platform imports", () => {
    const files = readdirSync(SRC_DIR, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !PLATFORM_FILES.has(file))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      const source = readFileSync(new URL(file, SRC_DIR), "utf-8")
      expect({ file, platformImport: FORBIDDEN_IMPORT.test(source) }).toEqual({
        file,
        platformImport: false
      })
    }
  })
})
