import { supportsColor } from "./colors"
import { createLogger } from "./logger"
import type { LoggerOptions } from "./types"

/**
 * ANSI color codes for HTTP status colorization
 */
const STATUS_COLORS = {
  success: "\u001b[32m", // green (2xx)
  redirect: "\u001b[36m", // cyan (3xx)
  clientError: "\u001b[33m", // yellow (4xx)
  serverError: "\u001b[31m", // red (5xx)
  reset: "\x1B[0m",
  dim: "\x1B[2m",
  bold: "\x1B[1m"
} as const

const INCOMING_REQUEST_REGEX = /^<--\s+(\w+)\s+(.+)$/
const OUTGOING_RESPONSE_REGEX = /^-->\s+(\w+)\s+(\S+)\s+(\d+)\s+(.+)$/
// Hono colors the status code itself when the terminal supports color
// ("\u001B[32m200\u001B[0m"), which would stop the status group from matching.
// oxlint-disable-next-line no-control-regex -- matching ESC is the point
const ANSI_ESCAPE_REGEX = /\u001B\[[0-9;]*m/g

/**
 * Get ANSI color code based on HTTP status code
 */
function getStatusColor(status: number): string {
  if (status >= 500) {
    return STATUS_COLORS.serverError
  }
  if (status >= 400) {
    return STATUS_COLORS.clientError
  }
  if (status >= 300) {
    return STATUS_COLORS.redirect
  }
  if (status >= 200) {
    return STATUS_COLORS.success
  }
  return STATUS_COLORS.reset
}

/**
 * Colorize HTTP method for better visibility
 */
function colorizeMethod(method: string, useColors: boolean): string {
  if (!useColors) {
    return method.padEnd(6)
  }

  const colors: Record<string, string> = {
    GET: "\x1B[32m", // green
    POST: "\x1B[34m", // blue
    PUT: "\x1B[33m", // yellow
    DELETE: "\x1B[31m", // red
    PATCH: "\x1B[35m", // magenta
    OPTIONS: "\x1B[36m", // cyan
    HEAD: "\x1B[90m" // gray
  }

  const color = colors[method] || STATUS_COLORS.reset
  return `${color}${method.padEnd(6)}${STATUS_COLORS.reset}`
}

/**
 * Parse Hono logger output to extract method, path, status, and time
 * Hono outputs:
 *   Incoming: "<-- GET /path"
 *   Outgoing: "--> GET /path 200 12ms"
 */
function parseHonoLog(message: string): {
  direction: "in" | "out"
  method: string
  path: string
  status?: number
  time?: string
} | null {
  const plain = message.replaceAll(ANSI_ESCAPE_REGEX, "")

  // Incoming request: <-- GET /path
  const inMatch = plain.match(INCOMING_REQUEST_REGEX)
  if (inMatch?.[1] && inMatch[2]) {
    return { direction: "in", method: inMatch[1], path: inMatch[2] }
  }

  // Outgoing response: --> GET /path 200 12ms
  const outMatch = plain.match(OUTGOING_RESPONSE_REGEX)
  if (outMatch?.[1] && outMatch[2] && outMatch[3] && outMatch[4]) {
    return {
      direction: "out",
      method: outMatch[1],
      path: outMatch[2],
      status: Number.parseInt(outMatch[3], 10),
      time: outMatch[4]
    }
  }

  return null
}

/**
 * Options for Hono logger integration
 */
export interface HonoLoggerOptions extends LoggerOptions {
  /** Show incoming requests (default: false to reduce noise) */
  showIncoming?: boolean
}

/**
 * Create a custom print function for Hono's logger middleware
 *
 * Integrates with @folionote/log for consistent colored output
 *
 * @example
 * ```ts
 * import { logger } from 'hono/logger'
 * import { createHonoLogger } from '@folionote/log'
 *
 * const honoLogger = createHonoLogger({ prefix: 'http' })
 * app.use(logger(honoLogger))
 * ```
 */
export function createHonoLogger(
  options: HonoLoggerOptions = {}
): (message: string, ...rest: string[]) => void {
  const { showIncoming = false, prefix = "http", ...loggerOptions } = options
  const log = createLogger({ prefix, ...loggerOptions })
  const useColors = supportsColor()

  return (message: string, ...rest: string[]) => {
    const parsed = parseHonoLog(message)

    if (!parsed) {
      // Fallback for unparseable messages
      log.info(message, ...rest)
      return
    }

    // Skip incoming requests if configured
    if (parsed.direction === "in" && !showIncoming) {
      return
    }

    if (parsed.direction === "in") {
      // Incoming request
      const method = colorizeMethod(parsed.method, useColors)
      log.debug(`${method} ${parsed.path} ←`)
    } else {
      // Outgoing response with status and time
      const method = colorizeMethod(parsed.method, useColors)
      const status = parsed.status ?? 0
      const statusColor = useColors ? getStatusColor(status) : ""
      const reset = useColors ? STATUS_COLORS.reset : ""
      const dim = useColors ? STATUS_COLORS.dim : ""
      const time = parsed.time ?? ""

      log.info(
        `${method} ${parsed.path} ${statusColor}${status}${reset} ${dim}${time}${reset}`
      )
    }
  }
}
