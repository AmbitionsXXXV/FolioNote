import { useEffect, useSyncExternalStore } from "react"

import {
  getBrowserEngineServerState,
  getBrowserEngineState,
  initBrowserEngine,
  subscribeBrowserEngine
} from "@/lib/japanese/browser-engine"
import type { BrowserEngineState } from "@/lib/japanese/browser-engine"

/** Live state of the in-browser Japanese engine (consent, cache, progress). */
export function useBrowserJapanese(): BrowserEngineState {
  const state = useSyncExternalStore(
    subscribeBrowserEngine,
    getBrowserEngineState,
    getBrowserEngineServerState
  )
  useEffect(() => {
    void initBrowserEngine()
  }, [])
  return state
}
