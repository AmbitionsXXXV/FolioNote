import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { session, user } from '../../src/schema/auth'
import { createTestUser } from '../fixtures/factories'
import { db } from '../setup'
import { cleanupDatabase } from '../utils/db-helper'

describe('Auth schema', () => {
	beforeEach(async () => {
		await cleanupDatabase()
	})

	it('creates user with required fields', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const result = await db.query.user.findFirst({
			where: eq(user.id, testUser.id),
		})

		expect(result?.email).toBe(testUser.email)
		expect(result?.name).toBe(testUser.name)
	})

	it('creates session with userId foreign key', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testSession = {
			id: crypto.randomUUID(),
			userId: testUser.id,
			expiresAt: new Date(Date.now() + 86_400_000),
			token: 'test-token',
			ipAddress: '127.0.0.1',
			userAgent: 'test-agent',
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		await db.insert(session).values(testSession)

		const result = await db.query.session.findFirst({
			where: eq(session.id, testSession.id),
			with: { user: true },
		})

		expect(result?.userId).toBe(testUser.id)
		expect(result?.user?.email).toBe(testUser.email)
	})

	it('cascades delete on user deletion', async () => {
		const testUser = createTestUser()
		await db.insert(user).values(testUser)

		const testSession = {
			id: crypto.randomUUID(),
			userId: testUser.id,
			expiresAt: new Date(Date.now() + 86_400_000),
			token: 'test-token',
			ipAddress: '127.0.0.1',
			userAgent: 'test-agent',
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		await db.insert(session).values(testSession)

		// Delete user
		await db.delete(user).where(eq(user.id, testUser.id))

		// Session should be deleted too
		const result = await db.query.session.findFirst({
			where: eq(session.id, testSession.id),
		})

		expect(result).toBeUndefined()
	})
})
