import { expo } from '@better-auth/expo'
import { db } from '@folio/db'
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from '@folio/db/schema/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user,
			userRelations,
			session,
			sessionRelations,
			account,
			accountRelations,
			verification,
		},
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || '', 'exp://', 'folio-note://'],
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: 'none',
			secure: true,
			httpOnly: true,
		},
	},
	plugins: [expo()],
})
