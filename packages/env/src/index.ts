/**
 * Unified environment variable access for both Cloudflare Workers and Node.js
 *
 * This module provides a centralized way to access environment variables
 * that works in both runtime environments:
 * - Node.js: Uses process.env directly (with dotenv loaded in entry point)
 * - Cloudflare Workers: Uses injected process.env from worker.ts
 *
 * All environment variables are accessed lazily to ensure they are available
 * when needed, especially in Cloudflare Workers where env is injected at runtime.
 */

// Ensure process.env exists in all environments
// biome-ignore lint/suspicious/noExplicitAny: Global polyfill for Workers
;(globalThis as any).process = (globalThis as any).process || { env: {} }

/**
 * Environment variable keys used by the application
 */
export type EnvKey =
	| 'DATABASE_URL'
	| 'BETTER_AUTH_SECRET'
	| 'BETTER_AUTH_URL'
	| 'CORS_ORIGIN'
	| 'GITHUB_CLIENT_ID'
	| 'GITHUB_CLIENT_SECRET'
	| 'GOOGLE_CLIENT_ID'
	| 'GOOGLE_CLIENT_SECRET'

/**
 * Cloudflare Workers environment bindings type
 */
export type CloudflareEnv = Record<EnvKey, string>

/**
 * Get an environment variable value
 * Returns empty string if not set
 */
export function getEnv(key: EnvKey): string {
	return process.env[key] || ''
}

/**
 * Get an environment variable value, throwing if not set
 */
export function requireEnv(key: EnvKey): string {
	const value = process.env[key]
	if (!value) {
		throw new Error(`Environment variable ${key} is required but not set`)
	}
	return value
}

/**
 * Inject Cloudflare Workers environment bindings into process.env
 * This should be called once at the start of each request in worker.ts
 */
export function injectCloudflareEnv(env: CloudflareEnv): void {
	for (const key of Object.keys(env) as EnvKey[]) {
		if (env[key]) {
			process.env[key] = env[key]
		}
	}
}

/**
 * Check if all required environment variables are set
 */
export function validateEnv(keys: EnvKey[]): { valid: boolean; missing: EnvKey[] } {
	const missing = keys.filter((key) => !process.env[key])
	return {
		valid: missing.length === 0,
		missing,
	}
}
