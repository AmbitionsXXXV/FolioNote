import type { entries, sources } from '../../src'

export const createTestUser = (overrides = {}) => ({
	id: crypto.randomUUID(),
	name: 'Test User',
	email: `test-${Date.now()}@example.com`,
	emailVerified: true,
	image: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides,
})

export const createTestEntry = (
	userId: string,
	overrides: Partial<typeof entries.$inferInsert> = {}
): typeof entries.$inferInsert => ({
	id: crypto.randomUUID(),
	userId,
	title: 'Test Entry',
	content: 'Test content for learning entry',
	isInbox: true,
	isStarred: false,
	isPinned: false,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
	...overrides,
})

export const createTestTag = (userId: string, overrides = {}) => ({
	id: crypto.randomUUID(),
	userId,
	name: 'JavaScript',
	color: '#f7df1e',
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides,
})

export const createTestSource = (
	userId: string,
	overrides: Partial<typeof sources.$inferInsert> = {}
): typeof sources.$inferInsert => ({
	id: crypto.randomUUID(),
	userId,
	type: 'link' as const,
	title: 'Test Source',
	url: 'https://example.com',
	author: 'Test Author',
	publishedAt: new Date(),
	metadata: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
	...overrides,
})
