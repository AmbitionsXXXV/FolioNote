import { drizzle } from 'drizzle-orm/node-postgres'

// Auth schema
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from './schema/auth'

// Business schema
import {
	attachments,
	attachmentsRelations,
	dailyLogs,
	dailyLogsRelations,
	entries,
	entriesRelations,
	entrySources,
	entrySourcesRelations,
	entryTags,
	entryTagsRelations,
	reviewEvents,
	reviewEventsRelations,
	sources,
	sourcesRelations,
	tags,
	tagsRelations,
} from './schema/entries'

export const db = drizzle(process.env.DATABASE_URL || '', {
	schema: {
		// Auth
		user,
		userRelations,
		session,
		sessionRelations,
		account,
		accountRelations,
		verification,
		// Business
		entries,
		entriesRelations,
		tags,
		tagsRelations,
		entryTags,
		entryTagsRelations,
		sources,
		sourcesRelations,
		entrySources,
		entrySourcesRelations,
		attachments,
		attachmentsRelations,
		reviewEvents,
		reviewEventsRelations,
		dailyLogs,
		dailyLogsRelations,
	},
})

// Re-export schema for external use
// biome-ignore lint/performance/noBarrelFile: Database package entry point needs to export all schemas
export {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from './schema/auth'

export {
	attachments,
	attachmentsRelations,
	dailyLogs,
	dailyLogsRelations,
	entries,
	entriesRelations,
	entrySources,
	entrySourcesRelations,
	entryTags,
	entryTagsRelations,
	reviewEvents,
	reviewEventsRelations,
	sources,
	sourcesRelations,
	tags,
	tagsRelations,
} from './schema/entries'
