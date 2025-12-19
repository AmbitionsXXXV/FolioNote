import type { user } from '../../src/schema/auth'
import type { entries, tags } from '../../src/schema/entries'
export declare const setupTestDatabase: () => void
export declare const cleanupDatabase: () => Promise<void>
export declare const seedTestData: (data: {
	users?: (typeof user.$inferInsert)[]
	entries?: (typeof entries.$inferInsert)[]
	tags?: (typeof tags.$inferInsert)[]
}) => Promise<void>
