import { getTableColumns, relations, sql } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector
} from "drizzle-orm/pg-core"

import { user } from "./auth"
import { entryLinks } from "./graph"

/** Raw binary column (pg bytea) — used for the Yjs update snapshot below. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea"
  }
})

/** PostgreSQL full-text search vector column. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector"
  }
})

/**
 * entries - 学习笔记/知识条目
 * 核心内容表，存储用户的学习笔记
 *
 * 内容存储策略：
 * - contentJson: ProseMirror JSON 格式（Tiptap doc），主存储格式
 * - contentText: 纯文本派生字段，用于 ILIKE 搜索与摘要预览
 */
export const entries = pgTable(
  "entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    /** ProseMirror JSON 格式内容（Tiptap doc） */
    contentJson: text("content_json"),
    /** 纯文本内容，用于搜索和预览 */
    contentText: text("content_text"),
    /** 是否在 inbox 中（未处理的快速捕获） */
    isInbox: boolean("is_inbox").notNull().default(true),
    /** 是否星标/收藏 */
    isStarred: boolean("is_starred").notNull().default(false),
    /** 是否置顶 */
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** 版本号，用于乐观锁并发控制 */
    version: text("version").notNull().default("1"),
    /** Entry 密码保护（bcrypt 哈希），null 表示无密码保护 */
    passwordHash: text("password_hash"),
    /** soft-delete 字段 */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Embedding 索引状态: 'pending' | 'indexed' | 'failed' | 'no_provider' */
    embeddingStatus: text("embedding_status"),
    /** 内容哈希（SHA-256），用于判断内容是否变更 */
    contentHash: text("content_hash"),
    /**
     * 预计算的全文搜索向量（title + contentText），由数据库自动维护。
     * 搜索必须用 `searchVector @@ to_tsquery(...)` 才能命中下面的 GIN 索引；
     * 在查询里现算 to_tsvector(...) 会退化成全表扫描。
     *
     * 表达式写成 PostgreSQL 规范化后的形式，避免 drizzle-kit 每次 generate
     * 都认为表达式变了而重建列。
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(content_text, ''::text)))`
    )
  },
  (table) => [
    index("entries_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("entries_user_id_is_inbox_idx").on(table.userId, table.isInbox),
    index("entries_user_id_is_starred_idx").on(table.userId, table.isStarred),
    index("entries_user_id_deleted_at_idx").on(table.userId, table.deletedAt),
    index("entries_search_vector_idx").using("gin", table.searchVector),
    /** 搜索/列表按 updated_at 倒序分页时的覆盖索引（只含未删除行） */
    index("entries_user_id_updated_at_not_deleted_idx")
      .on(table.userId, table.updatedAt.desc())
      .where(sql`deleted_at IS NULL`)
  ]
)

const { searchVector: _searchVector, ...entryPublicColumns } =
  getTableColumns(entries)

/**
 * entries 的全部列，去掉 search_vector。
 * 该列只为 GIN 索引服务，tsvector 文本和正文一样大，不应随响应发给客户端；
 * 读取 entries 整行时用 `db.select(entryColumns)` 代替 `db.select()`。
 */
export const entryColumns = entryPublicColumns

/** `db.select(entryColumns).from(entries)` 返回的行类型 */
export type EntryRow = Omit<typeof entries.$inferSelect, "searchVector">

export const entriesRelations = relations(entries, ({ one, many }) => ({
  user: one(user, {
    fields: [entries.userId],
    references: [user.id]
  }),
  entryTags: many(entryTags),
  entrySources: many(entrySources),
  attachments: many(attachments),
  reviewEvents: many(reviewEvents),
  reviewState: one(entryReviewState, {
    fields: [entries.id],
    references: [entryReviewState.entryId]
  }),
  entryShares: many(entryShares),
  outgoingLinks: many(entryLinks, { relationName: "outgoingLinks" }),
  incomingLinks: many(entryLinks, { relationName: "incomingLinks" }),
  entryChunks: many(entryChunks),
  entryCollaborators: many(entryCollaborators),
  syncState: one(entrySyncState, {
    fields: [entries.id],
    references: [entrySyncState.entryId]
  })
}))

/**
 * entry_chunks - 向量化分块
 * 存储 entry 的文本分块及其 embedding 向量，供 RAG 检索使用
 */
export const entryChunks = pgTable(
  "entry_chunks",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embedding_model"),
    contentHash: text("content_hash"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("entry_chunks_entry_id_idx").on(table.entryId),
    index("entry_chunks_user_id_idx").on(table.userId),
    index("entry_chunks_embedding_cosine_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    )
  ]
)

export const entryChunksRelations = relations(entryChunks, ({ one }) => ({
  entry: one(entries, {
    fields: [entryChunks.entryId],
    references: [entries.id]
  }),
  user: one(user, {
    fields: [entryChunks.userId],
    references: [user.id]
  })
}))

/**
 * tags - 标签
 * 用于分类和组织学习笔记
 */
export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** 标签颜色（可选，用于 UI 显示） */
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [index("tags_user_id_name_idx").on(table.userId, table.name)]
)

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, {
    fields: [tags.userId],
    references: [user.id]
  }),
  entryTags: many(entryTags)
}))

/**
 * entry_tags - 笔记与标签的多对多关系
 */
export const entryTags = pgTable(
  "entry_tags",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("entry_tags_entry_id_tag_id_idx").on(table.entryId, table.tagId),
    index("entry_tags_tag_id_idx").on(table.tagId)
  ]
)

export const entryTagsRelations = relations(entryTags, ({ one }) => ({
  entry: one(entries, {
    fields: [entryTags.entryId],
    references: [entries.id]
  }),
  tag: one(tags, {
    fields: [entryTags.tagId],
    references: [tags.id]
  })
}))

/**
 * sources - 来源
 * 可以是链接、PDF、书籍、章节等
 */
export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 来源类型：link, pdf, book, article, video, podcast, other */
    type: text("type").notNull().default("link"),
    title: text("title").notNull(),
    /** URL 链接（如果适用） */
    url: text("url"),
    /** 作者 */
    author: text("author"),
    /** 出版/发布日期 */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** 额外元数据（JSON 字符串） */
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** soft-delete 字段 */
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    index("sources_user_id_idx").on(table.userId),
    index("sources_user_id_type_idx").on(table.userId, table.type),
    index("sources_user_id_deleted_at_idx").on(table.userId, table.deletedAt)
  ]
)

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  user: one(user, {
    fields: [sources.userId],
    references: [user.id]
  }),
  entrySources: many(entrySources)
}))

/**
 * entry_sources - 笔记与来源的多对多关系
 */
export const entrySources = pgTable(
  "entry_sources",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    /** 笔记在来源中的位置（如页码、章节等） */
    position: text("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("entry_sources_entry_id_source_id_idx").on(
      table.entryId,
      table.sourceId
    ),
    index("entry_sources_source_id_idx").on(table.sourceId)
  ]
)

export const entrySourcesRelations = relations(entrySources, ({ one }) => ({
  entry: one(entries, {
    fields: [entrySources.entryId],
    references: [entries.id]
  }),
  source: one(sources, {
    fields: [entrySources.sourceId],
    references: [sources.id]
  })
}))

/**
 * attachments - 附件
 * 存储图片、文件等元数据
 */
export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entryId: text("entry_id").references(() => entries.id, {
      onDelete: "set null"
    }),
    /** 文件名 */
    filename: text("filename").notNull(),
    /** MIME 类型 */
    mimeType: text("mime_type").notNull(),
    /** 文件大小（字节） */
    size: text("size").notNull(),
    /** 存储路径/URL */
    storageKey: text("storage_key").notNull(),
    /** 缩略图路径（如果是图片） */
    thumbnailKey: text("thumbnail_key"),
    /** 图片描述（由视觉模型生成） */
    description: text("description"),
    /** 生成描述所使用的模型 ID */
    descriptionModel: text("description_model"),
    /** 图片描述生成时间 */
    descriptionGeneratedAt: timestamp("description_generated_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** soft-delete 字段 */
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    index("attachments_user_id_idx").on(table.userId),
    index("attachments_entry_id_idx").on(table.entryId),
    index("attachments_user_id_entry_id_idx").on(table.userId, table.entryId),
    index("attachments_user_id_deleted_at_idx").on(
      table.userId,
      table.deletedAt
    )
  ]
)

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  user: one(user, {
    fields: [attachments.userId],
    references: [user.id]
  }),
  entry: one(entries, {
    fields: [attachments.entryId],
    references: [entries.id]
  })
}))

/**
 * entry_review_state - 条目复习调度状态（快照）
 * 每个 entry 最多一条记录，懒创建（首次复习时创建）
 */
export const entryReviewState = pgTable(
  "entry_review_state",
  {
    // 使用 entryId 作为主键（方案 A）
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" })
      .primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** 下次到期时间（首次创建时 = now，后续由算法计算） */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    /** 上次复习时间 */
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),

    /** 当前间隔天数（首次 = 0，复习后 >= 1） */
    intervalDays: integer("interval_days").notNull().default(0),
    /** SM-2 ease factor，范围 [1.3, 3.0]，默认 2.5 */
    ease: real("ease").notNull().default(2.5),

    /** 连续正确复习次数 */
    reps: integer("reps").notNull().default(0),
    /** 遗忘次数（again 计数） */
    lapses: integer("lapses").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (t) => [
    // 核心查询索引：getQueue / getDueStats 按用户 + 到期时间查询
    index("entry_review_state_user_due_idx").on(t.userId, t.dueAt)
  ]
)

export const entryReviewStateRelations = relations(
  entryReviewState,
  ({ one }) => ({
    entry: one(entries, {
      fields: [entryReviewState.entryId],
      references: [entries.id]
    }),
    user: one(user, {
      fields: [entryReviewState.userId],
      references: [user.id]
    })
  })
)

/**
 * review_events - 复习事件
 * 记录每次复习的时间戳和评分
 */
export const reviewEvents = pgTable(
  "review_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    /** 复习时的备注（可选） */
    note: text("note"),
    /** 评分：again | hard | good | easy */
    rating: text("rating").notNull().default("good"),
    /** 本次复习后计算的下次到期时间（便于调参/回放） */
    scheduledDueAt: timestamp("scheduled_due_at", { withTimezone: true }),
    /** 复习时间 */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("review_events_user_id_idx").on(table.userId),
    index("review_events_entry_id_idx").on(table.entryId),
    index("review_events_reviewed_at_idx").on(table.reviewedAt)
  ]
)

export const reviewEventsRelations = relations(reviewEvents, ({ one }) => ({
  user: one(user, {
    fields: [reviewEvents.userId],
    references: [user.id]
  }),
  entry: one(entries, {
    fields: [reviewEvents.entryId],
    references: [entries.id]
  })
}))

/**
 * daily_logs - 每日日志（可选，Phase 1.5）
 * 用于每日回顾和学习统计
 */
export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 日期（YYYY-MM-DD 格式存储） */
    date: text("date").notNull(),
    /** 当日总结/反思 */
    summary: text("summary"),
    /** 当日心情/状态（可选） */
    mood: text("mood"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [index("daily_logs_user_id_date_idx").on(table.userId, table.date)]
)

export const dailyLogsRelations = relations(dailyLogs, ({ one }) => ({
  user: one(user, {
    fields: [dailyLogs.userId],
    references: [user.id]
  })
}))

/**
 * entry_shares - 条目分享配置
 * 存储分享链接的配置信息，支持公开/密码保护/过期时间
 */
export const entryShares = pgTable(
  "entry_shares",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** 分享 token（用于生成公开 URL） */
    shareToken: text("share_token").notNull().unique(),

    /** 密码保护（bcrypt 哈希），null 表示无密码保护 */
    passwordHash: text("password_hash"),

    /** 过期时间，null 表示永不过期 */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** 是否显示 FolioNote 品牌标识 */
    showBranding: boolean("show_branding").notNull().default(true),

    /** 是否启用分享 */
    isActive: boolean("is_active").notNull().default(true),

    /** 访问统计：查看次数 */
    viewCount: integer("view_count").notNull().default(0),
    /** 访问统计：最后访问时间 */
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("entry_shares_entry_id_idx").on(table.entryId),
    index("entry_shares_user_id_idx").on(table.userId),
    index("entry_shares_share_token_idx").on(table.shareToken)
  ]
)

export const entrySharesRelations = relations(entryShares, ({ one }) => ({
  entry: one(entries, {
    fields: [entryShares.entryId],
    references: [entries.id]
  }),
  user: one(user, {
    fields: [entryShares.userId],
    references: [user.id]
  })
}))

/**
 * entry_collaborators - 条目协作者
 * 邀请加入某个 entry 实时协作的注册用户及其角色。owner 本身不在这张表里
 * （owner 身份始终来自 entries.userId），这里只记录被邀请的其他用户。
 */
export const entryCollaborators = pgTable(
  "entry_collaborators",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 协作角色：'editor' 可编辑正文，'viewer' 仅只读查看 */
    role: text("role").notNull().default("editor"),
    /** 发出邀请的用户（审计用途，始终是 owner） */
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("entry_collaborators_entry_id_idx").on(table.entryId),
    index("entry_collaborators_user_id_idx").on(table.userId),
    uniqueIndex("entry_collaborators_entry_id_user_id_idx").on(
      table.entryId,
      table.userId
    )
  ]
)

export const entryCollaboratorsRelations = relations(
  entryCollaborators,
  ({ one }) => ({
    entry: one(entries, {
      fields: [entryCollaborators.entryId],
      references: [entries.id]
    }),
    user: one(user, {
      fields: [entryCollaborators.userId],
      references: [user.id],
      relationName: "collaboratorUser"
    }),
    invitedByUser: one(user, {
      fields: [entryCollaborators.invitedBy],
      references: [user.id],
      relationName: "invitedByUser"
    })
  })
)

/**
 * entry_sync_state - 协作 entry 的 Yjs 文档二进制快照
 *
 * 每个开启协作的 entry 最多一条记录（懒创建，首次协作连接时写入）。
 * contentHash 是这份快照落库时对应的 entries.contentJson 的 sha-256 摘要——
 * 与 entries.contentHash（RAG 变更检测用途）是两回事，是 collab server 自己的
 * 陈旧性哨兵：加载时若与当前 entries.contentJson 的哈希对不上，说明这个 entry
 * 在协作断开期间被 solo 保存路径改过，必须丢弃这份快照重新播种，否则会用旧
 * 内容覆盖掉新内容。
 */
export const entrySyncState = pgTable("entry_sync_state", {
  entryId: text("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" })
    .primaryKey(),
  /** Y.encodeStateAsUpdate(doc) 的二进制快照 */
  ydocState: bytea("ydoc_state").notNull(),
  contentHash: text("content_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

export const entrySyncStateRelations = relations(entrySyncState, ({ one }) => ({
  entry: one(entries, {
    fields: [entrySyncState.entryId],
    references: [entries.id]
  })
}))

/**
 * search_history - 搜索历史
 * 记录用户的搜索查询，用于历史记录和搜索建议
 */
export const searchHistory = pgTable(
  "search_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 搜索查询关键词 */
    query: text("query").notNull(),
    /** 搜索过滤器（JSON 字符串）：{ tagIds, sourceIds, dateRange, isInbox, isStarred } */
    filters: text("filters"),
    /** 搜索结果数量 */
    resultCount: integer("result_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("search_history_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    index("search_history_user_id_query_idx").on(table.userId, table.query)
  ]
)

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(user, {
    fields: [searchHistory.userId],
    references: [user.id]
  })
}))
