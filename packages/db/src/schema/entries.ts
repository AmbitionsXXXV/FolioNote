import { relations } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

/**
 * entries - 学习笔记/知识条目
 * 核心内容表，存储用户的学习笔记
 */
export const entries = pgTable(
	'entries',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default(''),
		content: text('content').notNull().default(''),
		/** 是否在 inbox 中（未处理的快速捕获） */
		isInbox: boolean('is_inbox').notNull().default(true),
		/** 是否星标/收藏 */
		isStarred: boolean('is_starred').notNull().default(false),
		/** 是否置顶 */
		isPinned: boolean('is_pinned').notNull().default(false),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		/** soft-delete 字段 */
		deletedAt: timestamp('deleted_at'),
	},
	(table) => [
		index('entries_user_id_updated_at_idx').on(table.userId, table.updatedAt),
		index('entries_user_id_is_inbox_idx').on(table.userId, table.isInbox),
		index('entries_user_id_is_starred_idx').on(table.userId, table.isStarred),
		index('entries_user_id_deleted_at_idx').on(table.userId, table.deletedAt),
	]
)

export const entriesRelations = relations(entries, ({ one, many }) => ({
	user: one(user, {
		fields: [entries.userId],
		references: [user.id],
	}),
	entryTags: many(entryTags),
	entrySources: many(entrySources),
	attachments: many(attachments),
	reviewEvents: many(reviewEvents),
}))

/**
 * tags - 标签
 * 用于分类和组织学习笔记
 */
export const tags = pgTable(
	'tags',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		/** 标签颜色（可选，用于 UI 显示） */
		color: text('color'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index('tags_user_id_name_idx').on(table.userId, table.name)]
)

export const tagsRelations = relations(tags, ({ one, many }) => ({
	user: one(user, {
		fields: [tags.userId],
		references: [user.id],
	}),
	entryTags: many(entryTags),
}))

/**
 * entry_tags - 笔记与标签的多对多关系
 */
export const entryTags = pgTable(
	'entry_tags',
	{
		id: text('id').primaryKey(),
		entryId: text('entry_id')
			.notNull()
			.references(() => entries.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('entry_tags_entry_id_tag_id_idx').on(table.entryId, table.tagId),
		index('entry_tags_tag_id_idx').on(table.tagId),
	]
)

export const entryTagsRelations = relations(entryTags, ({ one }) => ({
	entry: one(entries, {
		fields: [entryTags.entryId],
		references: [entries.id],
	}),
	tag: one(tags, {
		fields: [entryTags.tagId],
		references: [tags.id],
	}),
}))

/**
 * sources - 来源
 * 可以是链接、PDF、书籍、章节等
 */
export const sources = pgTable(
	'sources',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** 来源类型：link, pdf, book, article, video, podcast, other */
		type: text('type').notNull().default('link'),
		title: text('title').notNull(),
		/** URL 链接（如果适用） */
		url: text('url'),
		/** 作者 */
		author: text('author'),
		/** 出版/发布日期 */
		publishedAt: timestamp('published_at'),
		/** 额外元数据（JSON 字符串） */
		metadata: text('metadata'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		/** soft-delete 字段 */
		deletedAt: timestamp('deleted_at'),
	},
	(table) => [
		index('sources_user_id_idx').on(table.userId),
		index('sources_user_id_type_idx').on(table.userId, table.type),
		index('sources_user_id_deleted_at_idx').on(table.userId, table.deletedAt),
	]
)

export const sourcesRelations = relations(sources, ({ one, many }) => ({
	user: one(user, {
		fields: [sources.userId],
		references: [user.id],
	}),
	entrySources: many(entrySources),
}))

/**
 * entry_sources - 笔记与来源的多对多关系
 */
export const entrySources = pgTable(
	'entry_sources',
	{
		id: text('id').primaryKey(),
		entryId: text('entry_id')
			.notNull()
			.references(() => entries.id, { onDelete: 'cascade' }),
		sourceId: text('source_id')
			.notNull()
			.references(() => sources.id, { onDelete: 'cascade' }),
		/** 笔记在来源中的位置（如页码、章节等） */
		position: text('position'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('entry_sources_entry_id_source_id_idx').on(table.entryId, table.sourceId),
		index('entry_sources_source_id_idx').on(table.sourceId),
	]
)

export const entrySourcesRelations = relations(entrySources, ({ one }) => ({
	entry: one(entries, {
		fields: [entrySources.entryId],
		references: [entries.id],
	}),
	source: one(sources, {
		fields: [entrySources.sourceId],
		references: [sources.id],
	}),
}))

/**
 * attachments - 附件
 * 存储图片、文件等元数据
 */
export const attachments = pgTable(
	'attachments',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entryId: text('entry_id').references(() => entries.id, { onDelete: 'set null' }),
		/** 文件名 */
		filename: text('filename').notNull(),
		/** MIME 类型 */
		mimeType: text('mime_type').notNull(),
		/** 文件大小（字节） */
		size: text('size').notNull(),
		/** 存储路径/URL */
		storageKey: text('storage_key').notNull(),
		/** 缩略图路径（如果是图片） */
		thumbnailKey: text('thumbnail_key'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		/** soft-delete 字段 */
		deletedAt: timestamp('deleted_at'),
	},
	(table) => [
		index('attachments_user_id_idx').on(table.userId),
		index('attachments_entry_id_idx').on(table.entryId),
		index('attachments_user_id_deleted_at_idx').on(table.userId, table.deletedAt),
	]
)

export const attachmentsRelations = relations(attachments, ({ one }) => ({
	user: one(user, {
		fields: [attachments.userId],
		references: [user.id],
	}),
	entry: one(entries, {
		fields: [attachments.entryId],
		references: [entries.id],
	}),
}))

/**
 * review_events - 复习事件
 * 记录每次复习的时间戳
 */
export const reviewEvents = pgTable(
	'review_events',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entryId: text('entry_id')
			.notNull()
			.references(() => entries.id, { onDelete: 'cascade' }),
		/** 复习时的备注（可选） */
		note: text('note'),
		/** 复习时间 */
		reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('review_events_user_id_idx').on(table.userId),
		index('review_events_entry_id_idx').on(table.entryId),
		index('review_events_reviewed_at_idx').on(table.reviewedAt),
	]
)

export const reviewEventsRelations = relations(reviewEvents, ({ one }) => ({
	user: one(user, {
		fields: [reviewEvents.userId],
		references: [user.id],
	}),
	entry: one(entries, {
		fields: [reviewEvents.entryId],
		references: [entries.id],
	}),
}))

/**
 * daily_logs - 每日日志（可选，Phase 1.5）
 * 用于每日回顾和学习统计
 */
export const dailyLogs = pgTable(
	'daily_logs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** 日期（YYYY-MM-DD 格式存储） */
		date: text('date').notNull(),
		/** 当日总结/反思 */
		summary: text('summary'),
		/** 当日心情/状态（可选） */
		mood: text('mood'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index('daily_logs_user_id_date_idx').on(table.userId, table.date)]
)

export const dailyLogsRelations = relations(dailyLogs, ({ one }) => ({
	user: one(user, {
		fields: [dailyLogs.userId],
		references: [user.id],
	}),
}))
