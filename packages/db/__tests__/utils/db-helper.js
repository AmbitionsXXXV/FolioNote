import { db } from '../../src'
import { account, session, user, verification } from '../../src/schema/auth'
import {
	attachments,
	dailyLogs,
	entries,
	entrySources,
	entryTags,
	reviewEvents,
	sources,
	tags,
} from '../../src/schema/entries'
export const setupTestDatabase = () => {
	console.log('Setting up test database...')
	// If using real PostgreSQL, ensure test database exists
}
export const cleanupDatabase = async () => {
	// Clean in reverse order of foreign key dependencies
	await db.delete(reviewEvents)
	await db.delete(dailyLogs)
	await db.delete(attachments)
	await db.delete(entrySources)
	await db.delete(entryTags)
	await db.delete(entries)
	await db.delete(tags)
	await db.delete(sources)
	await db.delete(verification)
	await db.delete(session)
	await db.delete(account)
	await db.delete(user)
}
export const seedTestData = async (data) => {
	if (data.users) {
		await db.insert(user).values(data.users)
	}
	if (data.entries) {
		await db.insert(entries).values(data.entries)
	}
	if (data.tags) {
		await db.insert(tags).values(data.tags)
	}
}
