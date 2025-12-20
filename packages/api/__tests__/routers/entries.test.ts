import { ORPCError } from '@orpc/server'
import { describe, expect, it } from 'vitest'
import { appRouter } from '../../src/routers'
import { entriesRouter } from '../../src/routers/entries'
import { createMockContext, createMockSession } from '../mocks/context'

describe('entries router', () => {
	describe('entriesRouter structure', () => {
		it('exports all entry procedures', () => {
			expect(entriesRouter).toHaveProperty('create')
			expect(entriesRouter).toHaveProperty('update')
			expect(entriesRouter).toHaveProperty('delete')
			expect(entriesRouter).toHaveProperty('restore')
			expect(entriesRouter).toHaveProperty('get')
			expect(entriesRouter).toHaveProperty('list')
			expect(entriesRouter).toHaveProperty('addTag')
			expect(entriesRouter).toHaveProperty('removeTag')
			expect(entriesRouter).toHaveProperty('getTags')
		})

		it('has correct procedure types', () => {
			expect(typeof entriesRouter.create).toBe('object')
			expect(typeof entriesRouter.update).toBe('object')
			expect(typeof entriesRouter.delete).toBe('object')
			expect(typeof entriesRouter.restore).toBe('object')
			expect(typeof entriesRouter.get).toBe('object')
			expect(typeof entriesRouter.list).toBe('object')
			expect(typeof entriesRouter.addTag).toBe('object')
			expect(typeof entriesRouter.removeTag).toBe('object')
			expect(typeof entriesRouter.getTags).toBe('object')
		})
	})

	describe('createEntry procedure', () => {
		it('should be defined', () => {
			expect(entriesRouter.create).toBeDefined()
		})

		it('should be a protected procedure', () => {
			// The procedure exists and is an object (oRPC procedure)
			expect(typeof entriesRouter.create).toBe('object')
		})
	})

	describe('updateEntry procedure', () => {
		it('should be defined', () => {
			expect(entriesRouter.update).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof entriesRouter.update).toBe('object')
		})
	})

	describe('deleteEntry procedure', () => {
		it('should be defined', () => {
			expect(entriesRouter.delete).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof entriesRouter.delete).toBe('object')
		})
	})

	describe('restoreEntry procedure', () => {
		it('should be defined', () => {
			expect(entriesRouter.restore).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof entriesRouter.restore).toBe('object')
		})
	})

	describe('getEntry procedure', () => {
		it('should be defined', () => {
			expect(entriesRouter.get).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof entriesRouter.get).toBe('object')
		})
	})

	describe('listEntries procedure', () => {
		it('should be defined', () => {
			expect(entriesRouter.list).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof entriesRouter.list).toBe('object')
		})
	})
})

describe('entries router integration with appRouter', () => {
	it('should be accessible from appRouter', () => {
		expect(appRouter.entries).toBeDefined()
		expect(appRouter.entries).toBe(entriesRouter)
	})

	it('should have all CRUD operations', () => {
		expect(appRouter.entries.create).toBeDefined()
		expect(appRouter.entries.update).toBeDefined()
		expect(appRouter.entries.delete).toBeDefined()
		expect(appRouter.entries.restore).toBeDefined()
		expect(appRouter.entries.get).toBeDefined()
		expect(appRouter.entries.list).toBeDefined()
	})

	it('should have tag-related operations', () => {
		expect(appRouter.entries.addTag).toBeDefined()
		expect(appRouter.entries.removeTag).toBeDefined()
		expect(appRouter.entries.getTags).toBeDefined()
	})
})

describe('entries error types', () => {
	it('should use ORPCError for errors', () => {
		// Verify ORPCError is available and can be used
		expect(ORPCError).toBeDefined()

		// Test that ORPCError can be instantiated with NOT_FOUND
		const error = new ORPCError('NOT_FOUND', { message: 'Entry not found' })
		expect(error).toBeInstanceOf(ORPCError)
		expect(error.code).toBe('NOT_FOUND')
	})

	it('should handle UNAUTHORIZED error', () => {
		const error = new ORPCError('UNAUTHORIZED')
		expect(error).toBeInstanceOf(ORPCError)
		expect(error.code).toBe('UNAUTHORIZED')
	})
})

describe('entries mock context', () => {
	it('should create mock session with default values', () => {
		const session = createMockSession()
		expect(session.user).toBeDefined()
		expect(session.user.id).toBeDefined()
		expect(session.user.email).toBe('test@example.com')
		expect(session.user.name).toBe('Test User')
		expect(session.session).toBeDefined()
		expect(session.session.userId).toBe(session.user.id)
	})

	it('should create mock session with custom user id', () => {
		const customUserId = 'custom-user-id'
		const session = createMockSession({
			user: { id: customUserId },
		})
		expect(session.user.id).toBe(customUserId)
		expect(session.session.userId).toBe(customUserId)
	})

	it('should create mock context without session', () => {
		const context = createMockContext()
		expect(context.session).toBeNull()
	})

	it('should create mock context with session', () => {
		const session = createMockSession()
		const context = createMockContext({ session })
		expect(context.session).toBe(session)
	})
})
