import { describe, expect, it } from 'vitest'
import app from '../../src/index'

describe('CORS Integration', () => {
	it('adds CORS headers to responses', async () => {
		const testOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000'
		const req = new Request('http://localhost/', {
			method: 'GET',
			headers: {
				Origin: testOrigin,
			},
		})

		const res = await app.fetch(req)

		const allowOrigin = res.headers.get('Access-Control-Allow-Origin')
		expect(allowOrigin).toBe(testOrigin)
	})

	it('handles preflight OPTIONS requests', async () => {
		const testOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000'
		const req = new Request('http://localhost/rpc/healthCheck', {
			method: 'OPTIONS',
			headers: {
				Origin: testOrigin,
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'Content-Type',
			},
		})

		const res = await app.fetch(req)

		expect(res.status).toBeLessThan(300)
		const allowMethods = res.headers.get('Access-Control-Allow-Methods')
		expect(allowMethods).toContain('POST')
	})

	it('includes credentials support', async () => {
		const testOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000'
		const req = new Request('http://localhost/', {
			method: 'GET',
			headers: {
				Origin: testOrigin,
			},
		})

		const res = await app.fetch(req)

		const allowCredentials = res.headers.get('Access-Control-Allow-Credentials')
		expect(allowCredentials).toBe('true')
	})
})
