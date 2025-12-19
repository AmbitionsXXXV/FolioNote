import type { session, user } from '@folio/db/schema/auth'
import type { Context } from '../../src/context'

type User = typeof user.$inferSelect
type Session = typeof session.$inferSelect

type MockSessionOverrides = {
	user?: Partial<User>
	session?: Partial<Session>
}

type MockSessionResult = {
	user: User
	session: Session
}

export const createMockContext = (overrides: Partial<Context> = {}): Context => ({
	session: null,
	...overrides,
})

export const createMockSession = (
	overrides: MockSessionOverrides = {}
): MockSessionResult => {
	const userId = overrides.user?.id ?? crypto.randomUUID()

	return {
		user: {
			id: userId,
			email: 'test@example.com',
			name: 'Test User',
			emailVerified: true,
			image: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			...overrides.user,
		},
		session: {
			id: crypto.randomUUID(),
			userId,
			expiresAt: new Date(Date.now() + 86_400_000),
			token: 'test-token',
			ipAddress: '127.0.0.1',
			userAgent: 'test-agent',
			createdAt: new Date(),
			updatedAt: new Date(),
			...overrides.session,
		},
	}
}
