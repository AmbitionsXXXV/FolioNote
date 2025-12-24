/**
 * Environment variables type definition for Cloudflare Workers
 * Separated from app.ts to avoid circular imports and ensure
 * process.env injection happens before module initialization.
 */
export type Env = {
	DATABASE_URL: string
	BETTER_AUTH_SECRET: string
	BETTER_AUTH_URL: string
	CORS_ORIGIN: string
	GITHUB_CLIENT_ID: string
	GITHUB_CLIENT_SECRET: string
	GOOGLE_CLIENT_ID: string
	GOOGLE_CLIENT_SECRET: string
}
