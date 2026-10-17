import {
  buildNotionAuthorizeUrl,
  exchangeNotionCode,
  readNotionOAuthConfig
} from "@folionote/api/connectors/notion"
import { saveNotionConnection } from "@folionote/api/connectors/notion-store"
import { createContext } from "@folionote/api/context"
import { createLogger } from "@folionote/log"
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie"

import type { App } from "../types"
import { isAllowedOrigin } from "../utils/allowed-origin"

const log = createLogger({ prefix: "connections" })

const STATE_COOKIE = "folio_notion_oauth"
const STATE_COOKIE_PATH = "/api/connections/notion"
const STATE_TTL_SECONDS = 600
const DEFAULT_RETURN_PATH = "/settings/connections"

interface OAuthState {
  state: string
  userId: string
  returnTo: string
}

function cookieSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required")
  }
  return secret
}

/** Only ever redirect back to our own web origins (no open redirect). */
function resolveReturnTo(raw: string | undefined): string | null {
  const fallbackOrigin = process.env.CORS_ORIGIN?.split(",")[0]?.trim()
  const candidate =
    raw ?? (fallbackOrigin ? `${fallbackOrigin}${DEFAULT_RETURN_PATH}` : null)
  if (!candidate) {
    return null
  }
  try {
    const url = new URL(candidate)
    return isAllowedOrigin(url.origin) ? url.toString() : null
  } catch {
    return null
  }
}

function withResult(returnTo: string, result: string): string {
  const url = new URL(returnTo)
  url.searchParams.set("notion", result)
  return url.toString()
}

/**
 * Notion public-integration OAuth. The browser navigates here top-level
 * (session cookie included); state lives in a short-lived signed cookie
 * bound to the user, so a callback can't be replayed into another account.
 */
export function registerConnectionRoutes(app: App) {
  app.get("/api/connections/notion/start", async (c) => {
    const config = readNotionOAuthConfig()
    if (!config) {
      return c.json({ error: "Notion is not configured" }, 404)
    }
    const returnTo = resolveReturnTo(c.req.query("returnTo"))
    if (!returnTo) {
      return c.json({ error: "Invalid returnTo" }, 400)
    }
    const ctx = await createContext({ context: c })
    if (!ctx.session?.user) {
      return c.redirect(withResult(returnTo, "unauthorized"))
    }

    const payload: OAuthState = {
      state: crypto.randomUUID(),
      userId: ctx.session.user.id,
      returnTo
    }
    await setSignedCookie(
      c,
      STATE_COOKIE,
      JSON.stringify(payload),
      cookieSecret(),
      {
        path: STATE_COOKIE_PATH,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: STATE_TTL_SECONDS
      }
    )
    return c.redirect(buildNotionAuthorizeUrl(config, payload.state))
  })

  app.get("/api/connections/notion/callback", async (c) => {
    const config = readNotionOAuthConfig()
    const raw = await getSignedCookie(c, cookieSecret(), STATE_COOKIE)
    deleteCookie(c, STATE_COOKIE, { path: STATE_COOKIE_PATH })
    if (!(config && raw)) {
      return c.json({ error: "OAuth session expired, start again" }, 400)
    }

    const saved = JSON.parse(raw) as OAuthState
    if (c.req.query("state") !== saved.state) {
      return c.json({ error: "OAuth state mismatch" }, 400)
    }
    const ctx = await createContext({ context: c })
    if (ctx.session?.user.id !== saved.userId) {
      return c.redirect(withResult(saved.returnTo, "unauthorized"))
    }
    // User pressed Cancel in Notion's consent screen
    if (c.req.query("error")) {
      return c.redirect(withResult(saved.returnTo, "denied"))
    }
    const code = c.req.query("code")
    if (!code) {
      return c.redirect(withResult(saved.returnTo, "failed"))
    }

    try {
      const token = await exchangeNotionCode(config, code)
      await saveNotionConnection(saved.userId, token)
      return c.redirect(withResult(saved.returnTo, "connected"))
    } catch (error) {
      log.error("Notion OAuth exchange failed", error)
      return c.redirect(withResult(saved.returnTo, "failed"))
    }
  })
}
