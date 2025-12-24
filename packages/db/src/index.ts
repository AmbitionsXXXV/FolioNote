import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

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
	entryReviewState,
	entryReviewStateRelations,
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

const schema = {
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
	entryReviewState,
	entryReviewStateRelations,
	dailyLogs,
	dailyLogsRelations,
}

// Detect runtime environment
const isCloudflareWorkers =
	typeof globalThis !== 'undefined' &&
	// @ts-expect-error - Cloudflare Workers specific global
	typeof globalThis.caches !== 'undefined' &&
	// @ts-expect-error - Cloudflare Workers specific global
	typeof globalThis.caches.default !== 'undefined'

/**
 * Create database connection based on runtime environment
 * - Node.js: uses node-postgres (pg)
 * - Cloudflare Workers: uses postgres.js with connection settings optimized for serverless
 */
export function createDb(connectionString: string) {
	if (isCloudflareWorkers) {
		// Cloudflare Workers: use postgres.js with serverless-optimized settings
		const client = postgres(connectionString, {
			prepare: false, // Required for Supabase transaction pooler
			idle_timeout: 20, // Close idle connections after 20 seconds
			max_lifetime: 60 * 30, // Max connection lifetime: 30 minutes
			connect_timeout: 10, // Connection timeout: 10 seconds
		})
		return drizzlePostgresJs(client, { schema })
	}

	// Node.js: use node-postgres
	return drizzleNodePostgres(connectionString, { schema })
}

/**
 * Get DATABASE_URL from process.env
 * This function is called lazily to ensure env vars are available
 */
function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL
	if (!url) {
		throw new Error(
			'DATABASE_URL is not set. Make sure environment variables are configured before accessing the database.'
		)
	}
	return url
}

// Lazy-initialized db instance
// Uses a Proxy to defer initialization until first access
// This is critical for Cloudflare Workers where process.env is not available at module load time
let _db: ReturnType<typeof createDb> | null = null
let _dbUrl = ''

export const db = new Proxy({} as ReturnType<typeof createDb>, {
	get(_target, prop) {
		const currentUrl = getDatabaseUrl()

		// Recreate db if URL changed (shouldn't happen in production, but safety check)
		if (!_db || _dbUrl !== currentUrl) {
			_db = createDb(currentUrl)
			_dbUrl = currentUrl
		}

		return (_db as unknown as Record<string | symbol, unknown>)[prop]
	},
})

// Re-export schema for external use
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
	entryReviewState,
	entryReviewStateRelations,
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

// Export schema object for external use
export { schema }
