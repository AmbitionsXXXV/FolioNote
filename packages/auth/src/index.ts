import { db } from '@ai-start/db'
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from '@ai-start/db/schema/auth'
import { expo } from '@better-auth/expo'
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
	trustedOrigins: [process.env.CORS_ORIGIN || '', 'mybettertapp://', 'exp://'],
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
