/**
 * Server environment validation.
 *
 * Imported first in `index.ts` (after `dotenv/config`) so the process fails fast
 * with a clear message when a required variable is missing, instead of failing
 * deep inside a request with a confusing error.
 */
import { createLogger } from "@folionote/log"
import { z } from "zod"

const log = createLogger({ prefix: "env" })

const RECOMMENDED_SECRET_LENGTH = 32

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  CORS_ORIGIN: z.string().optional(),
  PORT: z.string().optional(),
  /** Shared secret for GET /internal/perf. Route is disabled when unset. */
  PERF_TOKEN: z.string().min(16).optional(),
  /** Calls slower than this (ms) are logged individually. Default 500. */
  PERF_SLOW_MS: z.coerce.number().int().positive().default(500)
})

const parsed = serverEnvSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n")
  throw new Error(`Invalid server environment:\n${issues}`)
}

if (parsed.data.BETTER_AUTH_SECRET.length < RECOMMENDED_SECRET_LENGTH) {
  log.warn(
    `BETTER_AUTH_SECRET is shorter than ${RECOMMENDED_SECRET_LENGTH} chars; use a longer secret for stronger session-cookie signing.`
  )
}

export const env = parsed.data
