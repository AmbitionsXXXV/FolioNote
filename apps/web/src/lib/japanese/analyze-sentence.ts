import type { AnalyzedText } from "@folionote/japanese"

import { client } from "@/utils/orpc"

import {
  analyzeInBrowser,
  getBrowserEngineState,
  isBrowserAnalyzerReady,
  isServerRecentlyUnavailable,
  markServerUnavailable
} from "./browser-engine"

export type AnalysisSource = "server" | "browser"

export interface SentenceAnalysis {
  analysis: AnalyzedText
  source: AnalysisSource
}

const hasCode = (error: unknown): error is { code: unknown } =>
  typeof error === "object" && error !== null && "code" in error

export const isServiceUnavailable = (error: unknown): boolean =>
  hasCode(error) && error.code === "SERVICE_UNAVAILABLE"

/** SERVICE_UNAVAILABLE, or no ORPC code at all: the request never got through. */
export const isServerUnavailable = (error: unknown): boolean =>
  isServiceUnavailable(error) || !hasCode(error)

/**
 * Server first; this browser's own engine when the user opted in and the
 * server is (or was just) unavailable. Both return the same AnalyzedText.
 */
export async function analyzeSentence(text: string): Promise<SentenceAnalysis> {
  const { consent, dictionary } = getBrowserEngineState()
  const preferBrowser =
    consent === true &&
    dictionary !== null &&
    (isBrowserAnalyzerReady() || isServerRecentlyUnavailable())
  if (preferBrowser) {
    return { analysis: await analyzeInBrowser(text), source: "browser" }
  }
  try {
    const analysis = await client.japanese.analyze({ text })
    return { analysis, source: "server" }
  } catch (error) {
    if (!isServerUnavailable(error)) throw error
    markServerUnavailable()
    if (consent === true) {
      // Consent given earlier: the download (if the cache was evicted) and
      // the build show their progress in the engine banner.
      return { analysis: await analyzeInBrowser(text), source: "browser" }
    }
    throw error
  }
}
