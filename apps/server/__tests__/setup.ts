import { afterAll, afterEach, beforeAll } from 'bun:test'
import {
	cleanupDatabase,
	setupTestDatabase,
} from '@folio/db/__tests__/utils/db-helper'

beforeAll(() => {
	setupTestDatabase()
	console.log('Test database ready')
})

afterEach(async () => {
	await cleanupDatabase()
})

afterAll(() => {
	// Close database connections if needed
})
