import { describe, expect, it } from 'vitest'
import { createApp, type Env } from '../../src/app'

describe('CORS Integration', () => {
	const configuredCorsOrigin = 'http://localhost:3000/'
	const requestOrigin = 'http://localhost:3000'

	const env: Env = {
		DATABASE_URL: 'postgresql://localhost:5432/folio_note',
		BETTER_AUTH_SECRET: 'test-secret',
		BETTER_AUTH_URL: 'http://localhost:3000',
		CORS_ORIGIN: configuredCorsOrigin,
		GITHUB_CLIENT_ID: 'test-github-client-id',
		GITHUB_CLIENT_SECRET: 'test-github-client-secret',
		GOOGLE_CLIENT_ID: 'test-google-client-id',
		GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
	}

	const app = createApp(env)

	it('handles preflight OPTIONS requests when CORS_ORIGIN has a trailing slash', async () => {
		const req = new Request('http://localhost/rpc/healthCheck', {
			method: 'OPTIONS',
			headers: {
				Origin: requestOrigin,
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'Content-Type',
			},
		})

		const res = await app.fetch(req)

		expect(res.status).toBe(204)
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe(requestOrigin)
		expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')

		const allowMethods = res.headers.get('Access-Control-Allow-Methods')
		expect(allowMethods).toContain('POST')
	})

	it('does not set Access-Control-Allow-Origin for untrusted origins', async () => {
		const req = new Request('http://localhost/rpc/healthCheck', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://evil.example.com',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'Content-Type',
			},
		})

		const res = await app.fetch(req)

		expect(res.status).toBe(204)
		expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
		expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
	})
})
