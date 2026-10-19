import { useEffect, useSyncExternalStore } from "react"

import {
  getOnDeviceEngineState,
  initOnDeviceEngine,
  subscribeOnDeviceEngine
} from "@/lib/japanese/on-device-engine"
import type { OnDeviceEngineState } from "@/lib/japanese/on-device-engine"

/** Live state of the on-device Japanese engine (consent, cache, progress). */
export function useOnDeviceJapanese(): OnDeviceEngineState {
  const state = useSyncExternalStore(
    subscribeOnDeviceEngine,
    getOnDeviceEngineState,
    getOnDeviceEngineState
  )
  useEffect(() => {
    void initOnDeviceEngine()
  }, [])
  return state
}
