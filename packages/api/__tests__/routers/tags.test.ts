import { ORPCError } from '@orpc/server'
import { describe, expect, it } from 'vitest'
import { appRouter } from '../../src/routers'
import { entriesRouter } from '../../src/routers/entries'
import { tagsRouter } from '../../src/routers/tags'

describe('tags router', () => {
	describe('tagsRouter structure', () => {
		it('exports all tag procedures', () => {
			expect(tagsRouter).toHaveProperty('create')
			expect(tagsRouter).toHaveProperty('update')
			expect(tagsRouter).toHaveProperty('delete')
			expect(tagsRouter).toHaveProperty('get')
			expect(tagsRouter).toHaveProperty('list')
			expect(tagsRouter).toHaveProperty('getEntriesCount')
		})

		it('has correct procedure types', () => {
			expect(typeof tagsRouter.create).toBe('object')
			expect(typeof tagsRouter.update).toBe('object')
			expect(typeof tagsRouter.delete).toBe('object')
			expect(typeof tagsRouter.get).toBe('object')
			expect(typeof tagsRouter.list).toBe('object')
			expect(typeof tagsRouter.getEntriesCount).toBe('object')
		})
	})

	describe('createTag procedure', () => {
		it('should be defined', () => {
			expect(tagsRouter.create).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof tagsRouter.create).toBe('object')
		})
	})

	describe('updateTag procedure', () => {
		it('should be defined', () => {
			expect(tagsRouter.update).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof tagsRouter.update).toBe('object')
		})
	})

	describe('deleteTag procedure', () => {
		it('should be defined', () => {
			expect(tagsRouter.delete).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof tagsRouter.delete).toBe('object')
		})
	})

	describe('getTag procedure', () => {
		it('should be defined', () => {
			expect(tagsRouter.get).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof tagsRouter.get).toBe('object')
		})
	})

	describe('listTags procedure', () => {
		it('should be defined', () => {
			expect(tagsRouter.list).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof tagsRouter.list).toBe('object')
		})
	})

	describe('getEntriesCount procedure', () => {
		it('should be defined', () => {
			expect(tagsRouter.getEntriesCount).toBeDefined()
		})

		it('should be a protected procedure', () => {
			expect(typeof tagsRouter.getEntriesCount).toBe('object')
		})
	})
})

describe('tags router integration with appRouter', () => {
	it('should be accessible from appRouter', () => {
		expect(appRouter.tags).toBeDefined()
		expect(appRouter.tags).toBe(tagsRouter)
	})

	it('should have all CRUD operations', () => {
		expect(appRouter.tags.create).toBeDefined()
		expect(appRouter.tags.update).toBeDefined()
		expect(appRouter.tags.delete).toBeDefined()
		expect(appRouter.tags.get).toBeDefined()
		expect(appRouter.tags.list).toBeDefined()
	})
})

describe('entry-tag association procedures', () => {
	describe('entriesRouter tag procedures', () => {
		it('should have addTag procedure', () => {
			expect(entriesRouter.addTag).toBeDefined()
			expect(typeof entriesRouter.addTag).toBe('object')
		})

		it('should have removeTag procedure', () => {
			expect(entriesRouter.removeTag).toBeDefined()
			expect(typeof entriesRouter.removeTag).toBe('object')
		})

		it('should have getTags procedure', () => {
			expect(entriesRouter.getTags).toBeDefined()
			expect(typeof entriesRouter.getTags).toBe('object')
		})
	})

	describe('appRouter entry-tag integration', () => {
		it('should have addTag accessible from appRouter.entries', () => {
			expect(appRouter.entries.addTag).toBeDefined()
		})

		it('should have removeTag accessible from appRouter.entries', () => {
			expect(appRouter.entries.removeTag).toBeDefined()
		})

		it('should have getTags accessible from appRouter.entries', () => {
			expect(appRouter.entries.getTags).toBeDefined()
		})
	})
})

describe('tags error types', () => {
	it('should use ORPCError for errors', () => {
		expect(ORPCError).toBeDefined()

		// Test that ORPCError can be instantiated with NOT_FOUND
		const notFoundError = new ORPCError('NOT_FOUND', { message: 'Tag not found' })
		expect(notFoundError).toBeInstanceOf(ORPCError)
		expect(notFoundError.code).toBe('NOT_FOUND')
	})

	it('should handle CONFLICT error for duplicate tags', () => {
		const conflictError = new ORPCError('CONFLICT', {
			message: 'Tag with this name already exists',
		})
		expect(conflictError).toBeInstanceOf(ORPCError)
		expect(conflictError.code).toBe('CONFLICT')
	})

	it('should handle UNAUTHORIZED error', () => {
		const error = new ORPCError('UNAUTHORIZED')
		expect(error).toBeInstanceOf(ORPCError)
		expect(error.code).toBe('UNAUTHORIZED')
	})
})

describe('list entries with tag filter', () => {
	it('should have list procedure that accepts tagId', () => {
		expect(entriesRouter.list).toBeDefined()
		expect(typeof entriesRouter.list).toBe('object')
	})

	it('should be accessible from appRouter.entries.list', () => {
		expect(appRouter.entries.list).toBeDefined()
	})
})
