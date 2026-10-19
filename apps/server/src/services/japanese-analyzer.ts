import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { fetchUrlBytes } from "@folionote/ai-tools/web-fetch/api"
import {
  setJapaneseAnalyzer,
  setJapaneseUrlFetcher
} from "@folionote/api/routers/japanese"
import { createAnalyzer } from "@folionote/japanese"
import { createKuromojiEngine } from "@folionote/japanese/kuromoji"
import { createNodeDictionaryLoader } from "@folionote/japanese/loaders/node"
import { createLogger } from "@folionote/log"

const log = createLogger({ prefix: "japanese" })

/**
 * The deployed server is only dist/, with no node_modules, so the build writes
 * the trimmed IPADIC dictionary to dist/japanese-dict/ (scripts/prepare-japanese-dict.mjs).
 * In dev that folder doesn't exist and the loader resolves the package itself.
 */
function resolveDictDir(): string | undefined {
  if (process.env.JAPANESE_DICT_DIR) {
    return process.env.JAPANESE_DICT_DIR
  }
  const bundled = fileURLToPath(new URL("japanese-dict/", import.meta.url))
  return existsSync(bundled) ? bundled : undefined
}

/**
 * With the trimmed dictionary the tokenizer still adds ~104 MB RSS per process
 * (packed server measured 330 → 434 MB on macOS), close to each PM2
 * instance's 500M max_memory_restart. So it stays opt-in in production until
 * production RSS confirms the headroom.
 */
function isAnalyzerEnabled(): boolean {
  const flag = process.env.JAPANESE_ANALYZER_ENABLED
  if (flag !== undefined) {
    return flag === "true"
  }
  return process.env.NODE_ENV !== "production"
}

/**
 * Builds the analyzer once and hands it to the japanese router. A failure is
 * logged loudly but does not stop the server: japanese.analyze then answers
 * SERVICE_UNAVAILABLE instead of returning empty results.
 */
export async function initJapaneseAnalyzer(): Promise<void> {
  setJapaneseUrlFetcher(fetchUrlBytes)
  if (!isAnalyzerEnabled()) {
    log.warn(
      "Japanese analyzer disabled (set JAPANESE_ANALYZER_ENABLED=true); japanese.analyze will return SERVICE_UNAVAILABLE"
    )
    return
  }
  const startedAt = performance.now()
  try {
    const engine = await createKuromojiEngine({
      loader: createNodeDictionaryLoader(resolveDictDir())
    })
    const analyzer = createAnalyzer({ engine })
    await analyzer.analyze("日本語を勉強しています。")
    setJapaneseAnalyzer(analyzer)
    log.info(
      `Japanese analyzer ready in ${Math.round(performance.now() - startedAt)}ms`
    )
  } catch (error) {
    log.error(
      "Japanese analyzer failed to start; japanese.analyze will return SERVICE_UNAVAILABLE",
      error
    )
  }
}
