import type { Context } from '../../src/context'

export const createMockContext = (overrides: Partial<Context> = {}): Context => ({
	session: null,
	...overrides,
})

export const createMockSession = (overrides = {}) => ({
	user: {
		id: crypto.randomUUID(),
		email: 'test@example.com',
		name: 'Test User',
		emailVerified: true,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	},
	session: {
		id: crypto.randomUUID(),
		userId: 'user-123',
		expiresAt: new Date(Date.now() + 86_400_000),
		token: 'test-token',
		ipAddress: '127.0.0.1',
		userAgent: 'test-agent',
		createdAt: new Date(),
		updatedAt: new Date(),
	},
})
