/**
 * Cloudflare Workers entry point
 *
 * This file is used for production deployment to Cloudflare Workers.
 * For local development, use `pnpm dev:server` which runs the Node.js entry (index.ts).
 *
 * Environment variables are injected into process.env before any module access.
 */
import type { Env } from './env'

// Polyfill process.env for Cloudflare Workers
// This MUST happen before any other imports that might use process.env
// biome-ignore lint/suspicious/noExplicitAny: Workers global polyfill
;(globalThis as any).process = (globalThis as any).process || { env: {} }

// Cache the app instance to avoid re-initialization on every request
let cachedApp: Awaited<ReturnType<typeof import('./app').createApp>> | null = null

/**
 * Inject Cloudflare environment bindings into process.env
 * This must happen before any lazy-initialized modules access process.env
 */
function injectEnvVars(env: Env): void {
	process.env.DATABASE_URL = env.DATABASE_URL
	process.env.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET
	process.env.BETTER_AUTH_URL = env.BETTER_AUTH_URL
	process.env.CORS_ORIGIN = env.CORS_ORIGIN
	process.env.GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID
	process.env.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET
	process.env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID
	process.env.GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Always inject env vars to ensure they are up-to-date
		injectEnvVars(env)

		// Dynamic import to ensure env vars are set before module initialization
		// Cache the app to avoid re-creating on every request
		if (!cachedApp) {
			const { createApp } = await import('./app')
			cachedApp = createApp(env)
		}

		return cachedApp.fetch(request, env)
	},
}
