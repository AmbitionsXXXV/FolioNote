/**
 * Resolve an import source → fetched, converted, schema-valid documents.
 *
 * Both `imports.preview` and `imports.commit` go through here; commit never
 * trusts a client-supplied document, it re-fetches and re-converts.
 */
import { externalConnections } from "@folionote/db"
import { decodeJapaneseBytes, htmlToJapaneseText } from "@folionote/japanese"
import { uploadAttachment, validateAttachmentFile } from "@folionote/storage"
import type { AllowedAttachmentImageType } from "@folionote/storage"

import { googleDocToDocs } from "../importers/google-docs"
import type { GoogleDocument } from "../importers/google-docs"
import { markdownToDoc } from "../importers/markdown"
import { notionBlocksToDoc } from "../importers/notion"
import type { NotionBlock } from "../importers/notion"
import type { ConvertOptions, ImportedDoc, PMNode } from "../importers/types"
import { assertValidDoc } from "../importers/validate"
import { getJapaneseUrlFetcher } from "../routers/japanese-runtime"
import {
  fetchDriveFileMeta,
  fetchGoogleDocument,
  getGoogleDocsToken,
  parseGoogleDocId
} from "./google-docs"
import {
  NotionApiError,
  getNotionBlockTree,
  getNotionPage,
  notionPageTitleOf,
  parseNotionPageId
} from "./notion"
import {
  getNotionConnection,
  listNotionConnections,
  withNotionToken
} from "./notion-store"

type ConnectionRow = typeof externalConnections.$inferSelect

export type ImportProvider =
  | "notion"
  | "google_docs"
  | "claude_page"
  | "web"
  | "markdown"

export type ImportSource =
  | { provider: "notion"; ref: string; connectionId?: string }
  | { provider: "google_docs"; ref: string }
  | { provider: "web"; url: string }
  | {
      provider: "markdown" | "claude_page"
      markdown: string
      title?: string
      url?: string
    }

export interface ResolvedImport {
  provider: ImportProvider
  externalId: string
  url: string | null
  connectionId: string | null
  /** Source-side version for watch mode; null when the source has none. */
  sourceRevision: string | null
  docs: ImportedDoc[]
}

export class ImportSourceError extends Error {
  readonly reason:
    | "invalid_ref"
    | "not_connected"
    | "not_found"
    | "scope_missing"
    | "unavailable"

  constructor(reason: ImportSourceError["reason"], message: string) {
    super(message)
    this.name = "ImportSourceError"
    this.reason = reason
  }
}

const PARAGRAPH_BREAK = /\n{2,}/
const FIRST_LINE = /\r\n|\r|\n/
const HTML_CONTENT_TYPE = /(?:text\/html|application\/xhtml\+xml)/i
const WEB_MAX_CHARS = 200_000
const NOT_FOUND_STATUSES = new Set([400, 403, 404])

/** Converts twice: first to learn which images expire, then with re-hosted URLs. */
async function convertWithRehostedImages(
  userId: string,
  convert: (options: ConvertOptions) => ImportedDoc[]
): Promise<ImportedDoc[]> {
  const first = convert({})
  const expiring = [...new Set(first.flatMap((doc) => doc.assetUrls))]
  if (expiring.length === 0) {
    return first
  }
  const mapping = new Map<string, string>()
  for (const url of expiring) {
    const rehosted = await rehostImage(userId, url)
    if (rehosted) {
      mapping.set(url, rehosted)
    }
  }
  return convert({ mapImageUrl: (url) => mapping.get(url) ?? url })
}

async function rehostImage(
  userId: string,
  url: string
): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim()
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (
      !(
        contentType &&
        validateAttachmentFile(contentType, bytes.byteLength).valid
      )
    ) {
      return null
    }
    const uploaded = await uploadAttachment({
      userId,
      file: bytes,
      contentType: contentType as AllowedAttachmentImageType
    })
    return uploaded.publicUrl
  } catch {
    // Storage not configured or provider URL already gone: keep the original
    // link rather than failing the whole import over one image.
    return null
  }
}

async function findNotionPage(
  userId: string,
  pageId: string,
  connectionId?: string
) {
  const candidates: ConnectionRow[] = connectionId
    ? [await getNotionConnection(userId, connectionId)].filter(
        (row): row is ConnectionRow => row !== null
      )
    : await listNotionConnections(userId)
  if (candidates.length === 0) {
    throw new ImportSourceError("not_connected", "Connect Notion first")
  }
  // A page is only visible to the workspace connection it was shared with.
  for (const connection of candidates) {
    try {
      const page = await withNotionToken(connection, (token) =>
        getNotionPage(token, pageId)
      )
      return { connection, page }
    } catch (error) {
      if (
        error instanceof NotionApiError &&
        NOT_FOUND_STATUSES.has(error.status)
      ) {
        continue
      }
      throw error
    }
  }
  throw new ImportSourceError(
    "not_found",
    "This page isn't shared with FolioNote. Edit page access in Notion and try again."
  )
}

async function resolveNotion(
  userId: string,
  source: Extract<ImportSource, { provider: "notion" }>
): Promise<ResolvedImport> {
  const pageId = parseNotionPageId(source.ref)
  if (!pageId) {
    throw new ImportSourceError("invalid_ref", "Not a Notion page link")
  }
  const { connection, page } = await findNotionPage(
    userId,
    pageId,
    source.connectionId
  )
  const blocks = await withNotionToken(connection, (token) =>
    getNotionBlockTree(token, pageId)
  )
  const title = notionPageTitleOf(page)
  const docs = await convertWithRehostedImages(userId, (options) => [
    // The API's block JSON is the converter's input shape; it is untyped on the wire.
    notionBlocksToDoc(
      { title, blocks: blocks as unknown as NotionBlock[] },
      options
    )
  ])
  return {
    provider: "notion",
    externalId: pageId,
    url: page.url,
    connectionId: connection.id,
    sourceRevision: page.last_edited_time,
    docs
  }
}

async function resolveGoogleDoc(
  userId: string,
  source: Extract<ImportSource, { provider: "google_docs" }>
): Promise<ResolvedImport> {
  const docId = parseGoogleDocId(source.ref)
  if (!docId) {
    throw new ImportSourceError("invalid_ref", "Not a Google Docs link")
  }
  const token = await getGoogleDocsToken(userId)
  const [document, meta] = await Promise.all([
    fetchGoogleDocument<GoogleDocument>(token, docId),
    fetchDriveFileMeta(token, docId)
  ])
  const docs = await convertWithRehostedImages(userId, (options) =>
    googleDocToDocs(document, options)
  )
  return {
    provider: "google_docs",
    externalId: docId,
    url: meta.webViewLink ?? `https://docs.google.com/document/d/${docId}/edit`,
    connectionId: null,
    sourceRevision: meta.modifiedTime,
    docs
  }
}

function textToDoc(title: string, text: string): ImportedDoc {
  const content: PMNode[] = text
    .split(PARAGRAPH_BREAK)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => ({
      type: "paragraph",
      content: block.split(FIRST_LINE).flatMap((line, index) => {
        const nodes: PMNode[] = index > 0 ? [{ type: "hardBreak" }] : []
        return line ? [...nodes, { type: "text", text: line }] : nodes
      })
    }))
  return {
    title,
    doc: {
      type: "doc",
      content: content.length > 0 ? content : [{ type: "paragraph" }]
    },
    warnings: [
      {
        kind: "web",
        from: "Ads, navigation, comments",
        to: "Dropped",
        count: 1
      }
    ],
    assetUrls: []
  }
}

async function resolveWeb(
  source: Extract<ImportSource, { provider: "web" }>
): Promise<ResolvedImport> {
  const fetcher = getJapaneseUrlFetcher()
  if (!fetcher) {
    throw new ImportSourceError("unavailable", "URL fetching is not available")
  }
  // SSRF-guarded fetcher shared with the Japanese article import.
  const fetched = await fetcher(source.url)
  const decoded = decodeJapaneseBytes(fetched.bytes, fetched.contentType)
  const converted = HTML_CONTENT_TYPE.test(fetched.contentType)
    ? htmlToJapaneseText(decoded)
    : { title: null, text: decoded }
  const title =
    converted.title ||
    converted.text.trim().split(FIRST_LINE)[0]?.trim() ||
    new URL(fetched.url).host
  return {
    provider: "web",
    externalId: fetched.url,
    url: fetched.url,
    connectionId: null,
    sourceRevision: null,
    docs: [textToDoc(title, converted.text.slice(0, WEB_MAX_CHARS))]
  }
}

function resolveMarkdown(
  source: Extract<ImportSource, { provider: "markdown" | "claude_page" }>
): ResolvedImport {
  const doc = markdownToDoc(source.markdown, { titleFallback: source.title })
  return {
    provider: source.provider,
    externalId: source.url ?? `markdown:${doc.title}`,
    url: source.url ?? null,
    connectionId: null,
    sourceRevision: null,
    docs: [source.title ? { ...doc, title: source.title } : doc]
  }
}

export async function resolveImportSource(
  userId: string,
  source: ImportSource
): Promise<ResolvedImport> {
  const resolved = await (() => {
    switch (source.provider) {
      case "notion":
        return resolveNotion(userId, source)
      case "google_docs":
        return resolveGoogleDoc(userId, source)
      case "web":
        return resolveWeb(source)
      default:
        return resolveMarkdown(source)
    }
  })()
  for (const doc of resolved.docs) {
    assertValidDoc(doc.doc)
  }
  return resolved
}

/** Cheap "did the source change?" probe for watch mode; null = can't tell. */
export async function readSourceRevision(
  userId: string,
  link: {
    provider: ImportProvider
    externalId: string
    connectionId: string | null
  }
): Promise<string | null> {
  if (link.provider === "notion" && link.connectionId) {
    const connection = await getNotionConnection(userId, link.connectionId)
    if (!connection) {
      throw new ImportSourceError("not_connected", "Notion connection removed")
    }
    const page = await withNotionToken(connection, (token) =>
      getNotionPage(token, link.externalId)
    )
    return page.last_edited_time
  }
  if (link.provider === "google_docs") {
    const token = await getGoogleDocsToken(userId)
    const meta = await fetchDriveFileMeta(token, link.externalId)
    return meta.modifiedTime
  }
  return null
}
