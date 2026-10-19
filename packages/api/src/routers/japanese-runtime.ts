import type { JapaneseAnalyzer } from "@folionote/japanese"
import { JapaneseAnalyzerError } from "@folionote/japanese"
import { createLogger } from "@folionote/log"
import { ORPCError } from "@orpc/server"

const log = createLogger({ prefix: "japanese" })
let analyzer: JapaneseAnalyzer | null = null
export type JapaneseUrlFetcher = (
  url: string
) => Promise<{ url: string; bytes: Uint8Array; contentType: string }>
let urlFetcher: JapaneseUrlFetcher | null = null

// Server-owned capabilities: no engine, DNS or filesystem imports in API/SSR.
export function setJapaneseAnalyzer(next: JapaneseAnalyzer | null) {
  analyzer = next
}
export function getJapaneseAnalyzer() {
  return analyzer
}
export function setJapaneseUrlFetcher(next: JapaneseUrlFetcher | null) {
  urlFetcher = next
}
export function getJapaneseUrlFetcher() {
  return urlFetcher
}

export async function analyzeJapaneseText(text: string, engine = analyzer) {
  if (!engine)
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Japanese analyzer is not ready"
    })
  try {
    return await engine.analyze(text)
  } catch (error) {
    if (error instanceof JapaneseAnalyzerError) {
      if (error.code === "ENGINE_UNAVAILABLE") {
        log.error("Japanese analyzer failed", error)
        throw new ORPCError("SERVICE_UNAVAILABLE", { message: error.message })
      }
      throw new ORPCError("BAD_REQUEST", { message: error.message })
    }
    throw error
  }
}
