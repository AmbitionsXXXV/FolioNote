import "dotenv/config"
import "./env"
import { setContentChangeListener } from "@folionote/api/routers/entries"
import { createLogger } from "@folionote/log"
import { serve } from "@hono/node-server"

import { app } from "./app"
import { initI18n } from "./i18n"
import { initJapaneseAnalyzer } from "./services/japanese-analyzer"
import { indexQueue } from "./services/rag"

await initI18n()
// Not awaited: the dictionary takes a few seconds to load and must not delay
// readiness; japanese.analyze answers SERVICE_UNAVAILABLE until it is ready.
void initJapaneseAnalyzer()

setContentChangeListener((entryId, userId) => {
  indexQueue.enqueue(entryId, userId)
})

const log = createLogger({ prefix: "server" })

const port = Number(process.env.PORT) || 3000

const server = serve({ fetch: app.fetch, port }, (info) => {
  log.info(`Server is running on http://localhost:${info.port}`)
  // Tell PM2 (ecosystem `wait_ready`) the process is accepting traffic, so
  // cluster reloads wait for a real listen instead of the listen_timeout.
  process.send?.("ready")
})

// Graceful shutdown so PM2 cluster reloads/restarts drain in-flight requests
// rather than dropping them.
function shutdown(signal: string): void {
  log.info(`Received ${signal}, shutting down...`)
  server.close(() => process.exit(0))
  // Hard cap so a stuck connection can't block the reload indefinitely.
  setTimeout(() => process.exit(0), 8000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

export default app
