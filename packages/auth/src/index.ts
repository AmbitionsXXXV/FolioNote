import { expo } from '@better-auth/expo'
import { db } from '@folionote/db'
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from '@folionote/db/schema/auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import 'dotenv/config'

export const auth = betterAuth({
	// account: { skipStateCookieCheck: true },
	baseURL: process.env.BETTER_AUTH_URL as string,
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
	socialProviders: {
		github: {
			enabled: true,
			clientId: process.env.GITHUB_CLIENT_ID as string,
			clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
		},
		google: {
			enabled: true,
			prompt: 'select_account',
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		disableCSRFCheck: true,
		// crossSubDomainCookies: {
		// 	enabled: true,
		// 	domain: 'http://localhost',
		// },
		defaultCookieAttributes: {
			sameSite: 'none',
			secure: true,
			httpOnly: true,
			// partitioned: true,
		},
	},
	plugins: [expo()],
})
