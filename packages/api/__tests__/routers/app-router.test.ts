import { describe, expect, it } from 'bun:test'
import { appRouter } from '../../src/routers'

describe('appRouter structure', () => {
	it('exports healthCheck procedure', () => {
		expect(appRouter.healthCheck).toBeDefined()
		expect(typeof appRouter.healthCheck).toBe('object')
	})

	it('exports privateData procedure', () => {
		expect(appRouter.privateData).toBeDefined()
		expect(typeof appRouter.privateData).toBe('object')
	})

	it('has correct procedure types', () => {
		// Verify the router structure is correct
		expect(appRouter).toHaveProperty('healthCheck')
		expect(appRouter).toHaveProperty('privateData')
	})
})
