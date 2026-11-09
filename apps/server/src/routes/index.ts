import type { App } from "../types"
import { registerAiStreamRoute } from "./ai"
import { registerConnectionRoutes } from "./connections"
import { registerHealthRoutes } from "./health"
import { registerJapaneseDictRoutes } from "./japanese-dict"
import { registerPerfRoutes } from "./perf"
import { registerReindexRoute } from "./reindex"

/**
 * Register all application routes
 */
export function registerRoutes(app: App) {
  registerHealthRoutes(app)
  registerPerfRoutes(app)
  registerAiStreamRoute(app)
  registerReindexRoute(app)
  registerJapaneseDictRoutes(app)
  registerConnectionRoutes(app)
}
