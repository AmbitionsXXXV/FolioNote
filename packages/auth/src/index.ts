import { expo } from '@better-auth/expo'
import { db, schema } from '@folionote/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

const {
	user,
	userRelations,
	session,
	sessionRelations,
	account,
	accountRelations,
	verification,
} = schema

/**
 * Create Better Auth instance
 * This is extracted to a function to support lazy initialization
 */
function createAuth() {
	return betterAuth({
		baseURL: process.env.BETTER_AUTH_URL || '',
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
				clientId: process.env.GITHUB_CLIENT_ID || '',
				clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
			},
			google: {
				enabled: true,
				prompt: 'select_account',
				clientId: process.env.GOOGLE_CLIENT_ID || '',
				clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
			},
		},
		emailAndPassword: {
			enabled: true,
		},
		advanced: {
			disableCSRFCheck: true,
			defaultCookieAttributes: {
				sameSite: 'none',
				secure: true,
				httpOnly: true,
			},
		},
		plugins: [expo()],
	})
}

// Lazy-initialized auth instance
// Uses a getter to defer initialization until first access
// This is critical for Cloudflare Workers where process.env is not available at module load time
let _auth: ReturnType<typeof createAuth> | null = null

/**
 * Get the auth instance, initializing it lazily if needed
 * This ensures environment variables are available before initialization
 */
export function getAuth() {
	if (!_auth) {
		_auth = createAuth()
	}
	return _auth
}

/**
 * Proxy-based auth export for backward compatibility
 * Allows using `auth.api.xxx` syntax while still supporting lazy initialization
 */
export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
	get(_target, prop) {
		return (getAuth() as unknown as Record<string | symbol, unknown>)[prop]
	},
})
