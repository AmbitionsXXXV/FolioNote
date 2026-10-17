import type { TokenizerEngine } from "./engine"

export type RomajiMode = "hepburn" | false

export interface AnalyzerConfig {
  engine: TokenizerEngine
  /** Measured in UTF-16 code units, the same unit as morpheme offsets. */
  maxChars?: number
  romaji?: RomajiMode
}

export const DEFAULT_MAX_CHARS = 2000

export interface ResolvedAnalyzerConfig {
  engine: TokenizerEngine
  maxChars: number
  romaji: RomajiMode
}

export function resolveAnalyzerConfig(
  config: AnalyzerConfig
): ResolvedAnalyzerConfig {
  return {
    engine: config.engine,
    maxChars: config.maxChars ?? DEFAULT_MAX_CHARS,
    romaji: config.romaji ?? "hepburn"
  }
}
