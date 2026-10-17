/**
 * imports — bring Notion pages, Google Docs, Claude page exports, Markdown
 * and Japanese web articles in as entries, and keep track of their source.
 *
 * Sync modes implemented: `snapshot` (copy once) and `watch` (flag the entry
 * when the source changes; the user re-imports on demand). `pull` and
 * `two_way` are reserved in the schema but not accepted yet.
 */
import {
  db,
  entries,
  entryExternalLinks,
  entrySources,
  sources
} from "@folionote/db"
import { createLogger } from "@folionote/log"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import {
  GoogleDocsAccessError,
  getGoogleAccessStatus,
  getGoogleDocsToken
} from "../connectors/google-docs"
import {
  ImportSourceError,
  readSourceRevision,
  resolveImportSource
} from "../connectors/import-pipeline"
import type {
  ImportSource,
  ResolvedImport
} from "../connectors/import-pipeline"
import {
  NotionApiError,
  readNotionOAuthConfig,
  searchNotionPages,
  notionPageTitleOf
} from "../connectors/notion"
import {
  deleteNotionConnection,
  listNotionConnections,
  withNotionToken
} from "../connectors/notion-store"
import type { ImportedDoc } from "../importers/types"
import { protectedProcedure } from "../index"
import { processContentUpdate } from "../utils/content"
import { notifyEntryContentChanged } from "./entries"

const log = createLogger({ prefix: "imports" })

const MARKDOWN_MAX_CHARS = 500_000

const ImportSourceSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("notion"),
    ref: z.string().trim().min(1).max(2000),
    connectionId: z.string().optional()
  }),
  z.object({
    provider: z.literal("google_docs"),
    ref: z.string().trim().min(1).max(2000)
  }),
  z.object({
    provider: z.literal("web"),
    url: z.string().trim().url().max(4000)
  }),
  z.object({
    provider: z.enum(["markdown", "claude_page"]),
    markdown: z.string().min(1).max(MARKDOWN_MAX_CHARS),
    title: z.string().trim().max(500).optional(),
    url: z.string().trim().url().max(4000).optional()
  })
])

const ImportModeSchema = z.enum(["snapshot", "watch"])

const SOURCE_ERROR_CODES = {
  not_found: "NOT_FOUND",
  unavailable: "SERVICE_UNAVAILABLE",
  invalid_ref: "BAD_REQUEST",
  not_connected: "PRECONDITION_FAILED",
  scope_missing: "PRECONDITION_FAILED"
} as const satisfies Record<ImportSourceError["reason"], string>

/** Map connector failures onto oRPC errors the client can branch on. */
async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ImportSourceError) {
      throw new ORPCError(SOURCE_ERROR_CODES[error.reason], {
        message: error.message,
        data: { reason: error.reason }
      })
    }
    if (error instanceof GoogleDocsAccessError) {
      throw new ORPCError(
        error.reason === "not_found" ? "NOT_FOUND" : "PRECONDITION_FAILED",
        { message: error.message, data: { reason: error.reason } }
      )
    }
    if (error instanceof NotionApiError) {
      log.warn("Notion API error", { status: error.status, code: error.code })
      throw new ORPCError(
        error.status === 401 ? "PRECONDITION_FAILED" : "BAD_GATEWAY",
        {
          message:
            error.status === 401
              ? "Notion access expired, reconnect Notion"
              : "Notion request failed",
          data: { reason: error.status === 401 ? "not_connected" : "failed" }
        }
      )
    }
    throw error
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Buffer.from(digest).toString("hex")
}

function countBlocks(doc: ImportedDoc): number {
  return doc.doc.content.length
}

function excerptOf(doc: ImportedDoc): string {
  const processed = processContentUpdate(JSON.stringify(doc.doc))
  return (processed.contentText ?? "").slice(0, 280)
}

const connections = protectedProcedure.handler(async ({ context }) => {
  const userId = context.session.user.id
  const [notion, google] = await Promise.all([
    listNotionConnections(userId),
    getGoogleAccessStatus(userId)
  ])
  return {
    notion: {
      configured: readNotionOAuthConfig() !== null,
      connections: notion.map((row) => ({
        id: row.id,
        workspaceName: row.workspaceName,
        workspaceIcon: row.workspaceIcon,
        createdAt: row.createdAt
      }))
    },
    google: {
      configured: Boolean(process.env.GOOGLE_CLIENT_ID),
      ...google
    }
  }
})

const disconnectNotion = protectedProcedure
  .input(z.object({ connectionId: z.string() }))
  .handler(async ({ context, input }) => {
    const removed = await deleteNotionConnection(
      context.session.user.id,
      input.connectionId
    )
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Connection not found" })
    }
    return { success: true }
  })

/** The owner's own Docs-scoped token, for their Google Picker session. */
const googlePickerToken = protectedProcedure.handler(({ context }) =>
  guarded(async () => ({
    accessToken: await getGoogleDocsToken(context.session.user.id)
  }))
)

const searchNotion = protectedProcedure
  .input(z.object({ query: z.string().max(200).default("") }))
  .handler(({ context, input }) =>
    guarded(async () => {
      const rows = await listNotionConnections(context.session.user.id)
      const results = await Promise.all(
        rows.map(async (connection) => {
          const pages = await withNotionToken(connection, (token) =>
            searchNotionPages(token, input.query)
          )
          return pages.map((page) => ({
            id: page.id,
            title: notionPageTitleOf(page),
            url: page.url,
            icon:
              page.icon?.type === "emoji" ? (page.icon.emoji ?? null) : null,
            lastEditedTime: page.last_edited_time,
            connectionId: connection.id,
            workspaceName: connection.workspaceName
          }))
        })
      )
      return results
        .flat()
        .toSorted((a, b) => b.lastEditedTime.localeCompare(a.lastEditedTime))
    })
  )

const preview = protectedProcedure
  .input(z.object({ source: ImportSourceSchema }))
  .handler(({ context, input }) =>
    guarded(async () => {
      const resolved = await resolveImportSource(
        context.session.user.id,
        input.source as ImportSource
      )
      return {
        provider: resolved.provider,
        url: resolved.url,
        items: resolved.docs.map((doc) => ({
          title: doc.title,
          blockCount: countBlocks(doc),
          excerpt: excerptOf(doc),
          warnings: doc.warnings
        }))
      }
    })
  )

async function linkSourceRow(
  userId: string,
  entryId: string,
  resolved: ResolvedImport,
  title: string
): Promise<void> {
  if (!resolved.url) {
    return
  }
  // Shows up in the entry's existing "关联来源" list.
  const sourceId = nanoid()
  await db.insert(sources).values({
    id: sourceId,
    userId,
    type: resolved.provider === "web" ? "article" : "link",
    title,
    url: resolved.url,
    metadata: JSON.stringify({ importProvider: resolved.provider })
  })
  await db.insert(entrySources).values({ id: nanoid(), entryId, sourceId })
}

const commit = protectedProcedure
  .input(
    z.object({
      source: ImportSourceSchema,
      mode: ImportModeSchema.default("snapshot"),
      isInbox: z.boolean().default(false)
    })
  )
  .handler(({ context, input }) =>
    guarded(async () => {
      const userId = context.session.user.id
      const resolved = await resolveImportSource(
        userId,
        input.source as ImportSource
      )
      const watchable = resolved.sourceRevision !== null
      const mode = input.mode === "watch" && watchable ? "watch" : "snapshot"
      const multi = resolved.docs.length > 1
      const created: { id: string; title: string }[] = []

      for (const [index, doc] of resolved.docs.entries()) {
        const processed = processContentUpdate(JSON.stringify(doc.doc))
        const entryId = nanoid()
        await db.insert(entries).values({
          id: entryId,
          userId,
          title: doc.title,
          contentJson: processed.contentJson,
          contentText: processed.contentText,
          isInbox: input.isInbox
        })
        await db.insert(entryExternalLinks).values({
          id: nanoid(),
          entryId,
          userId,
          provider: resolved.provider,
          connectionId: resolved.connectionId,
          // One Google Doc with several tabs → one entry per tab.
          externalId: multi
            ? `${resolved.externalId}#${index}`
            : resolved.externalId,
          url: resolved.url,
          mode,
          status: mode === "watch" ? "up_to_date" : "not_tracked",
          sourceRevision: resolved.sourceRevision,
          sourceContentHash: await sha256(processed.contentJson ?? ""),
          lastSyncedAt: new Date(),
          lastCheckedAt: new Date()
        })
        await linkSourceRow(userId, entryId, resolved, doc.title)
        if (processed.contentText) {
          notifyEntryContentChanged(entryId, userId)
        }
        created.push({ id: entryId, title: doc.title })
      }
      return { entries: created, mode }
    })
  )

async function ownedLink(userId: string, entryId: string) {
  const [link] = await db
    .select()
    .from(entryExternalLinks)
    .where(
      and(
        eq(entryExternalLinks.entryId, entryId),
        eq(entryExternalLinks.userId, userId)
      )
    )
  return link ?? null
}

const linkForEntry = protectedProcedure
  .input(z.object({ entryId: z.string() }))
  .handler(({ context, input }) =>
    ownedLink(context.session.user.id, input.entryId)
  )

const listLinks = protectedProcedure.handler(({ context }) =>
  db
    .select({
      id: entryExternalLinks.id,
      entryId: entryExternalLinks.entryId,
      title: entries.title,
      provider: entryExternalLinks.provider,
      url: entryExternalLinks.url,
      mode: entryExternalLinks.mode,
      status: entryExternalLinks.status,
      lastSyncedAt: entryExternalLinks.lastSyncedAt,
      lastCheckedAt: entryExternalLinks.lastCheckedAt,
      lastError: entryExternalLinks.lastError
    })
    .from(entryExternalLinks)
    .innerJoin(entries, eq(entries.id, entryExternalLinks.entryId))
    .where(
      and(
        eq(entryExternalLinks.userId, context.session.user.id),
        isNull(entries.deletedAt)
      )
    )
    .orderBy(desc(entryExternalLinks.lastSyncedAt))
)

/** Watch mode: compare the source's revision with the one we imported. */
const checkLink = protectedProcedure
  .input(z.object({ entryId: z.string() }))
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const link = await ownedLink(userId, input.entryId)
    if (!link) {
      throw new ORPCError("NOT_FOUND", { message: "Entry has no source link" })
    }
    if (link.mode !== "watch") {
      return link
    }
    // Multi-tab Google entries share the doc's revision
    const externalId = link.externalId.split("#")[0] ?? link.externalId
    try {
      const revision = await readSourceRevision(userId, { ...link, externalId })
      const changed = revision !== null && revision !== link.sourceRevision
      const [updated] = await db
        .update(entryExternalLinks)
        .set({
          status: changed ? "source_changed" : "up_to_date",
          lastCheckedAt: new Date(),
          lastError: null
        })
        .where(eq(entryExternalLinks.id, link.id))
        .returning()
      return updated ?? link
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed"
      const [updated] = await db
        .update(entryExternalLinks)
        .set({ status: "error", lastCheckedAt: new Date(), lastError: message })
        .where(eq(entryExternalLinks.id, link.id))
        .returning()
      return updated ?? link
    }
  })

/** Markdown / Claude page imports have nothing to re-fetch. */
function reimportSourceOf(
  link: {
    provider: string
    externalId: string
    connectionId: string | null
    url: string
  },
  googleDocId: string
): ImportSource | null {
  switch (link.provider) {
    case "notion":
      return {
        provider: "notion",
        ref: link.externalId,
        connectionId: link.connectionId ?? undefined
      }
    case "google_docs":
      return { provider: "google_docs", ref: googleDocId }
    case "web":
      return { provider: "web", url: link.url }
    default:
      return null
  }
}

/**
 * Replace the entry's content with the source's current version. This is a
 * whole-document overwrite (the user confirmed it in the UI); local edits
 * made since the last import are not merged.
 */
const reimport = protectedProcedure
  .input(z.object({ entryId: z.string() }))
  .handler(({ context, input }) =>
    guarded(async () => {
      const userId = context.session.user.id
      const link = await ownedLink(userId, input.entryId)
      if (!link?.url) {
        throw new ORPCError("NOT_FOUND", {
          message: "Entry has no source link"
        })
      }
      const [docId, tab] = link.externalId.split("#")
      const source = reimportSourceOf(
        { ...link, url: link.url },
        docId ?? link.externalId
      )
      if (!source) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Re-import needs the file again for this source"
        })
      }
      const resolved = await resolveImportSource(userId, source)
      const doc = resolved.docs[tab ? Number(tab) : 0]
      if (!doc) {
        throw new ORPCError("NOT_FOUND", {
          message: "Source tab no longer exists"
        })
      }
      const processed = processContentUpdate(JSON.stringify(doc.doc))
      const [entry] = await db
        .update(entries)
        .set({
          contentJson: processed.contentJson,
          contentText: processed.contentText
        })
        .where(
          and(
            eq(entries.id, input.entryId),
            eq(entries.userId, userId),
            isNull(entries.deletedAt)
          )
        )
        .returning()
      if (!entry) {
        throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
      }
      await db
        .update(entryExternalLinks)
        .set({
          status: link.mode === "watch" ? "up_to_date" : "not_tracked",
          sourceRevision: resolved.sourceRevision,
          sourceContentHash: await sha256(processed.contentJson ?? ""),
          lastSyncedAt: new Date(),
          lastCheckedAt: new Date(),
          lastError: null
        })
        .where(eq(entryExternalLinks.id, link.id))
      notifyEntryContentChanged(entry.id, userId)
      return entry
    })
  )

export const importsRouter = {
  connections,
  disconnectNotion,
  googlePickerToken,
  searchNotion,
  preview,
  commit,
  linkForEntry,
  listLinks,
  checkLink,
  reimport
}
