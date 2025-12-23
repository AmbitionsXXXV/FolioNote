import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { user } from '../../src/schema/auth'
import { entries, entryTags, tags } from '../../src/schema/entries'
import {
	createTestEntry,
	createTestTag,
	createTestUser,
} from '../fixtures/factories'
import { db } from '../setup'
import { cleanupDatabase } from '../utils/db-helper'

describe('Entries schema', () => {
	beforeEach(async () => {
		await cleanupDatabase()
	})

	it('creates entry with required fields', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testEntry = createTestEntry(testUser.id)
		await db.insert(entries).values(testEntry)

		const result = await db.query.entries.findFirst({
			where: eq(entries.id, testEntry.id),
		})

		expect(result?.title).toBe(testEntry.title)
		expect(result?.content).toBe(testEntry.content)
		expect(result?.userId).toBe(testUser.id)
	})

	it('supports many-to-many with tags', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testEntry = createTestEntry(testUser.id)
		await db.insert(entries).values(testEntry)

		const testTag = createTestTag(testUser.id, { name: 'TypeScript' })
		await db.insert(tags).values(testTag)

		// Link entry to tag
		await db.insert(entryTags).values({
			id: crypto.randomUUID(),
			entryId: testEntry.id,
			tagId: testTag.id,
			createdAt: new Date(),
		})

		// Query with relations
		const result = await db.query.entries.findFirst({
			where: eq(entries.id, testEntry.id),
			with: {
				entryTags: {
					with: { tag: true },
				},
			},
		})

		expect(result?.entryTags).toHaveLength(1)
		expect(result?.entryTags[0].tag.name).toBe('TypeScript')
	})

	it('soft deletes entries', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testEntry = createTestEntry(testUser.id)
		await db.insert(entries).values(testEntry)

		// Soft delete
		await db
			.update(entries)
			.set({ deletedAt: new Date() })
			.where(eq(entries.id, testEntry.id))

		const result = await db.query.entries.findFirst({
			where: eq(entries.id, testEntry.id),
		})

		expect(result?.deletedAt).not.toBeNull()
	})

	it('cascades delete on user deletion', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testEntry = createTestEntry(testUser.id)
		await db.insert(entries).values(testEntry)

		// Delete user
		await db.delete(user).where(eq(user.id, testUser.id))

		// Entry should be deleted too
		const result = await db.query.entries.findFirst({
			where: eq(entries.id, testEntry.id),
		})

		expect(result).toBeUndefined()
	})

	it('queries relations correctly', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testEntry = createTestEntry(testUser.id)
		await db.insert(entries).values(testEntry)

		const result = await db.query.entries.findFirst({
			where: eq(entries.id, testEntry.id),
			with: { user: true },
		})

		expect(result?.user?.email).toBe(testUser.email)
	})
})
