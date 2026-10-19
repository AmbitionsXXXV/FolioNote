import { relations } from "drizzle-orm"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique
} from "drizzle-orm/pg-core"

import { user } from "./auth"
import { entries } from "./entries"

/**
 * external_connections - 第三方内容源的授权（目前只有 Notion）
 *
 * Google Docs 不在这里：它复用 Better Auth 的 Google 登录（account 表），
 * 只是追加 drive.file scope。Notion 是独立的 OAuth public integration，
 * 每个 workspace 一个 bot，一个用户可以连多个 workspace。
 *
 * token 以 AES-GCM 密文存储（见 packages/api/src/connectors/token-crypto.ts）。
 */
export const externalConnections = pgTable(
  "external_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["notion"] }).notNull(),
    /** Notion: bot_id — 授权的唯一标识，重新授权同一 workspace 时不变 */
    externalAccountId: text("external_account_id").notNull(),
    workspaceId: text("workspace_id"),
    workspaceName: text("workspace_name"),
    workspaceIcon: text("workspace_icon"),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    unique("external_connections_user_provider_account_uq").on(
      table.userId,
      table.provider,
      table.externalAccountId
    ),
    index("external_connections_user_id_idx").on(table.userId)
  ]
)

export const externalConnectionsRelations = relations(
  externalConnections,
  ({ one, many }) => ({
    user: one(user, {
      fields: [externalConnections.userId],
      references: [user.id]
    }),
    entryLinks: many(entryExternalLinks)
  })
)

/** A ProseMirror node as stored JSON (the editor schema validates it). */
export interface PullNodeJson {
  type: string
  attrs?: Record<string, unknown>
  content?: PullNodeJson[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

export interface PullBaseSnapshot {
  blocks: Record<string, { rev: string; node: PullNodeJson }>
}

export interface PullConflictRecord {
  key: string
  local: PullNodeJson
  incoming: PullNodeJson
  incomingRev: string
}

/**
 * entry_external_links - entry 与外部来源文档的同步关系（一个 entry 最多一个）
 *
 * sourceRevision 是来源侧的版本号（Notion last_edited_time / Drive
 * modifiedTime），用来廉价地判断“来源变了没有”；sourceContentHash 是上次导入
 * 时转换结果的哈希，用来排除只改了元数据的假变更。
 */
export const entryExternalLinks = pgTable(
  "entry_external_links",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", {
      enum: ["notion", "google_docs", "claude_page", "web", "markdown"]
    }).notNull(),
    /** Notion connection；Google 用 Better Auth account，链接类来源为 null */
    connectionId: text("connection_id").references(
      () => externalConnections.id,
      { onDelete: "set null" }
    ),
    /** Notion page id / Google doc id（多 tab 时为 `docId#tabId`）/ URL */
    externalId: text("external_id").notNull(),
    url: text("url"),
    mode: text("mode", {
      enum: ["snapshot", "watch", "pull", "two_way"]
    })
      .notNull()
      .default("snapshot"),
    status: text("status", {
      enum: ["up_to_date", "source_changed", "conflict", "error", "not_tracked"]
    })
      .notNull()
      .default("up_to_date"),
    sourceRevision: text("source_revision"),
    sourceContentHash: text("source_content_hash"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),
    /**
     * Pull mode only: each imported block as last pulled (key = Notion block
     * id) plus its source revision — the "base" of the block-level three-way
     * merge between the entry and the source.
     */
    baseSnapshot: jsonb("base_snapshot").$type<PullBaseSnapshot>(),
    /** Pull mode: blocks changed on both sides, awaiting the user's choice. */
    conflicts: jsonb("conflicts").$type<PullConflictRecord[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    unique("entry_external_links_entry_id_uq").on(table.entryId),
    index("entry_external_links_user_id_provider_idx").on(
      table.userId,
      table.provider
    )
  ]
)

export const entryExternalLinksRelations = relations(
  entryExternalLinks,
  ({ one }) => ({
    entry: one(entries, {
      fields: [entryExternalLinks.entryId],
      references: [entries.id]
    }),
    user: one(user, {
      fields: [entryExternalLinks.userId],
      references: [user.id]
    }),
    connection: one(externalConnections, {
      fields: [entryExternalLinks.connectionId],
      references: [externalConnections.id]
    })
  })
)
