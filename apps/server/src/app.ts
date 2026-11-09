import { createContext } from "@folionote/api/context"
import { appRouter } from "@folionote/api/routers/index"
import { auth } from "@folionote/auth"
import { defaultLanguage, supportedLanguages } from "@folionote/locales"
import { createHonoLogger, createLogger } from "@folionote/log"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { languageDetector } from "hono/language"
import { logger } from "hono/logger"
import { prettyJSON } from "hono/pretty-json"
import type { RequestIdVariables } from "hono/request-id"
import { requestId } from "hono/request-id"
import { timeout } from "hono/timeout"

import { env } from "./env"
import { registerRoutes } from "./routes"
import { recordTiming } from "./services/perf-metrics"
import { isAllowedOrigin } from "./utils/allowed-origin"
import { convertToSupportedLanguage } from "./utils/language"

const log = createLogger({ prefix: "server" })

// Define custom variables for Hono context
type AppVariables = RequestIdVariables & {
  language: string
}

log.info("CORS_ORIGIN", process.env.CORS_ORIGIN)

export const app = new Hono<{
  Variables: AppVariables
}>()

// Request ID middleware - generates unique ID for each request
app.use("*", requestId())

// Response compression is handled at the edge by Caddy (`encode gzip zstd`).
// Compressing here as well would waste CPU on the loopback hop and risks
// buffering the SSE AI stream, so it is intentionally omitted.

// Language detection middleware - detects user's preferred language
app.use(
  "*",
  languageDetector({
    supportedLanguages: [...supportedLanguages],
    fallbackLanguage: defaultLanguage,
    order: ["querystring", "header"],
    lookupQueryString: "lang",
    lookupFromHeaderKey: "accept-language",
    caches: false // Server-side doesn't need cookie caching
  })
)

app.use(prettyJSON())
app.use(logger(createHonoLogger()))
app.use(
  "/*",
  cors({
    // Reflects the origin only when allowed (CORS_ORIGIN, or localhost
    // outside production) — see utils/allowed-origin, shared with the
    // collab server's WebSocket upgrade, which CORS doesn't cover.
    origin: (origin) => (isAllowedOrigin(origin) ? origin : null),
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Locale",
      "Accept-Language"
    ],
    credentials: true
  }),
  timeout(30_000)
)

// Request timing for plain HTTP routes (auth, AI stream, dict, ...).
// oRPC procedures are timed per procedure by `timeProcedure` below instead,
// since they all share the /rpc/* path here.
const UNTIMED_PATHS = new Set(["/", "/health", "/ready", "/internal/perf"])
app.use("*", async (c, next) => {
  const path = c.req.path
  if (path.startsWith("/rpc/") || UNTIMED_PATHS.has(path)) {
    await next()
    return
  }
  const startedAt = performance.now()
  try {
    await next()
  } finally {
    const durationMs = performance.now() - startedAt
    // routePath collapses "/api/auth/sign-in/email" to "/api/auth/*" so the
    // series stays bounded; unmatched paths fall back to the literal path.
    const key = `http.${c.req.method} ${c.req.routePath || path}`
    recordTiming(key, durationMs, c.res.status < 500)
    if (durationMs >= env.PERF_SLOW_MS) {
      log.warn(
        `slow ${key} ${Math.round(durationMs)}ms status=${c.res.status} reqId=${c.get("requestId") ?? "-"}`
      )
    }
  }
})

// Auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))

/**
 * oRPC client interceptor: time every procedure call by its router path
 * (e.g. `rpc.entries.list`). Errors still propagate; they are only counted.
 */
const timeProcedure: NonNullable<
  ConstructorParameters<typeof RPCHandler>[1]
>["clientInterceptors"] = [
  async ({ path, next }) => {
    const key = `rpc.${path.join(".")}`
    const startedAt = performance.now()
    let ok = true
    try {
      return await next()
    } catch (error) {
      ok = false
      throw error
    } finally {
      const durationMs = performance.now() - startedAt
      recordTiming(key, durationMs, ok)
      if (durationMs >= env.PERF_SLOW_MS) {
        log.warn(`slow ${key} ${Math.round(durationMs)}ms ok=${ok}`)
      }
    }
  }
]

// oRPC handlers
export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()]
    })
  ],
  clientInterceptors: timeProcedure,
  interceptors: [
    onError((error) => {
      log.error("API error:", error)
    })
  ]
})

export const rpcHandler = new RPCHandler(appRouter, {
  clientInterceptors: timeProcedure,
  interceptors: [
    onError((error) => {
      log.error("RPC error:", error)
    })
  ]
})

// RPC/API middleware
app.use("/*", async (c, next) => {
  // Get detected language from middleware and convert to BCP47 format
  const detectedLanguage = c.get("language")
  const locale = convertToSupportedLanguage(detectedLanguage)

  const context = await createContext({ context: c, locale })

  // Add Request ID to response header for tracing
  const reqId = c.get("requestId")
  if (reqId) {
    c.header("X-Request-Id", reqId)
  }

  c.header("Vary", "Accept-Language, X-Locale")

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context
  })

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response)
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context
  })

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response)
  }

  await next()
})

// Register application routes
registerRoutes(app)
