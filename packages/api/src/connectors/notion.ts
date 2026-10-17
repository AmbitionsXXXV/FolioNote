/**
 * Notion public-integration client (OAuth 2.0, per
 * https://developers.notion.com/docs/authorization): the user picks pages in
 * Notion's own page picker, we store the access + refresh token pair, and
 * re-running the same authorize flow is how they change page access.
 *
 * Read-only for now — snapshot / watch imports never write back.
 */

const NOTION_API = "https://api.notion.com/v1"
export const NOTION_VERSION = "2026-03-11"
const MAX_BLOCK_DEPTH = 8
const MAX_BLOCKS = 5000
const MAX_RETRIES = 3
const DEFAULT_RETRY_AFTER_SECONDS = 1

const NOTION_ID_PATTERN =
  /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i

export interface NotionOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** null when Notion isn't configured on this deployment (UI hides the card). */
export function readNotionOAuthConfig(): NotionOAuthConfig | null {
  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET
  const base = process.env.BETTER_AUTH_URL ?? process.env.VITE_SERVER_URL
  const redirectUri =
    process.env.NOTION_REDIRECT_URI ??
    (base ? `${base.replace(/\/$/, "")}/api/connections/notion/callback` : "")
  if (!(clientId && clientSecret && redirectUri)) {
    return null
  }
  return { clientId, clientSecret, redirectUri }
}

export function buildNotionAuthorizeUrl(
  config: NotionOAuthConfig,
  state: string
): string {
  const url = new URL(`${NOTION_API}/oauth/authorize`)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("owner", "user")
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)
  return url.toString()
}

export interface NotionTokenResponse {
  access_token: string
  refresh_token?: string | null
  bot_id: string
  workspace_id: string
  workspace_name?: string | null
  workspace_icon?: string | null
}

async function postToken(
  config: NotionOAuthConfig,
  body: Record<string, string>
): Promise<NotionTokenResponse> {
  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64")
  const response = await fetch(`${NOTION_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    throw new NotionApiError(
      response.status,
      await readErrorCode(response),
      "Notion token request failed"
    )
  }
  return (await response.json()) as NotionTokenResponse
}

export function exchangeNotionCode(
  config: NotionOAuthConfig,
  code: string
): Promise<NotionTokenResponse> {
  return postToken(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri
  })
}

export function refreshNotionToken(
  config: NotionOAuthConfig,
  refreshToken: string
): Promise<NotionTokenResponse> {
  return postToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken
  })
}

export class NotionApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(`${message} (${status} ${code})`)
    this.name = "NotionApiError"
    this.status = status
    this.code = code
  }
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { code?: string; error?: string }
    return body.code ?? body.error ?? "unknown"
  } catch {
    return "unknown"
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Notion averages 3 req/s per integration; honour Retry-After on 429. */
async function notionFetch<T>(
  token: string,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${NOTION_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        ...(init.body ? { "Content-Type": "application/json" } : {})
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    })
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("Retry-After"))
      const seconds =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : DEFAULT_RETRY_AFTER_SECONDS
      await sleep(seconds * 1000)
      continue
    }
    if (!response.ok) {
      throw new NotionApiError(
        response.status,
        await readErrorCode(response),
        `Notion ${init.method ?? "GET"} ${path} failed`
      )
    }
    return (await response.json()) as T
  }
}

/** Accepts a page URL (any notion.so / notion.site form) or a raw id. */
export function parseNotionPageId(input: string): string | null {
  const trimmed = input.trim()
  const path = (() => {
    try {
      return new URL(trimmed).pathname
    } catch {
      return trimmed
    }
  })()
  const match = NOTION_ID_PATTERN.exec(path)
  if (!match?.[1]) {
    return null
  }
  const hex = match[1].replaceAll("-", "").toLowerCase()
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface NotionRichText {
  plain_text: string
}

export interface NotionPageObject {
  object: "page"
  id: string
  url: string
  last_edited_time: string
  in_trash?: boolean
  icon?: { type: string; emoji?: string } | null
  properties: Record<
    string,
    { type: string; title?: NotionRichText[] } | undefined
  >
}

export interface NotionBlockObject {
  object: "block"
  id: string
  type: string
  has_children: boolean
  children?: NotionBlockObject[]
  [key: string]: unknown
}

interface NotionList<T> {
  results: T[]
  has_more: boolean
  next_cursor: string | null
}

export function notionPageTitleOf(page: NotionPageObject): string {
  for (const property of Object.values(page.properties)) {
    if (property?.type === "title" && property.title) {
      return property.title.map((part) => part.plain_text).join("")
    }
  }
  return "Untitled"
}

export async function searchNotionPages(
  token: string,
  query: string
): Promise<NotionPageObject[]> {
  const result = await notionFetch<NotionList<NotionPageObject>>(
    token,
    "/search",
    {
      method: "POST",
      body: {
        query,
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 25
      }
    }
  )
  return result.results.filter((page) => !page.in_trash)
}

export function getNotionPage(
  token: string,
  pageId: string
): Promise<NotionPageObject> {
  return notionFetch<NotionPageObject>(token, `/pages/${pageId}`)
}

/** Block types whose children are separate pages, never inlined. */
const OPAQUE_CHILD_TYPES = new Set(["child_page", "child_database"])

/**
 * Fetches a page's block tree depth-first. Children are fetched serially to
 * stay inside Notion's rate limit; MAX_BLOCKS guards against pathological
 * pages hanging an import request.
 */
export async function getNotionBlockTree(
  token: string,
  blockId: string
): Promise<NotionBlockObject[]> {
  let fetched = 0

  const walk = async (
    parentId: string,
    depth: number
  ): Promise<NotionBlockObject[]> => {
    const blocks: NotionBlockObject[] = []
    let cursor: string | null = null
    do {
      const query = cursor
        ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}`
        : "?page_size=100"
      const page: NotionList<NotionBlockObject> = await notionFetch(
        token,
        `/blocks/${parentId}/children${query}`
      )
      blocks.push(...page.results)
      fetched += page.results.length
      if (fetched > MAX_BLOCKS) {
        throw new NotionApiError(
          413,
          "too_many_blocks",
          "Notion page too large"
        )
      }
      cursor = page.has_more ? page.next_cursor : null
    } while (cursor)

    if (depth < MAX_BLOCK_DEPTH) {
      for (const block of blocks) {
        if (block.has_children && !OPAQUE_CHILD_TYPES.has(block.type)) {
          block.children = await walk(block.id, depth + 1)
        }
      }
    }
    return blocks
  }

  return walk(blockId, 0)
}
