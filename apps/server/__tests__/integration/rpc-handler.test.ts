import { describe, expect, it } from 'bun:test'
import app from '../../src/index'

describe('RPC Handler Integration', () => {
	it('handles health check RPC call', async () => {
		const req = new Request('http://localhost/rpc/healthCheck', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		})

		const res = await app.fetch(req)
		expect(res.status).toBe(200)

		const data = (await res.json()) as { json: string }
		// oRPC wraps the response in a json property
		expect(data.json).toBe('OK')
	})

	it('rejects protected RPC without auth', async () => {
		const req = new Request('http://localhost/rpc/privateData', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		})

		const res = await app.fetch(req)

		// Should return error for unauthorized
		expect(res.status).toBeGreaterThanOrEqual(400)
	})

	it('returns 404 for non-existent RPC', async () => {
		const req = new Request('http://localhost/rpc/nonExistent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		})

		const res = await app.fetch(req)
		expect(res.status).toBe(404)
	})
})
