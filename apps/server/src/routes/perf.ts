import { env } from "../env"
import { getPerfSnapshot } from "../services/perf-metrics"
import type { App } from "../types"

/**
 * GET /internal/perf — per-endpoint latency percentiles collected in-process.
 *
 * Gated by the PERF_TOKEN env var (sent as `X-Perf-Token`). When the variable
 * is unset the route answers 404 so production never exposes it by accident.
 *
 *   curl -H "X-Perf-Token: $PERF_TOKEN" https://<server>/internal/perf
 */
export function registerPerfRoutes(app: App) {
  app.get("/internal/perf", (c) => {
    const token = env.PERF_TOKEN
    if (!token) {
      return c.notFound()
    }
    if (c.req.header("X-Perf-Token") !== token) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    return c.json(getPerfSnapshot())
  })
}
