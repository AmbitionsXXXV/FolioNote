import type { App } from "../types"
import { registerAiStreamRoute } from "./ai"
import { registerHealthRoutes } from "./health"
import { registerJapaneseDictRoutes } from "./japanese-dict"
import { registerReindexRoute } from "./reindex"

/**
 * Register all application routes
 */
export function registerRoutes(app: App) {
  registerHealthRoutes(app)
  registerAiStreamRoute(app)
  registerReindexRoute(app)
  registerJapaneseDictRoutes(app)
}
