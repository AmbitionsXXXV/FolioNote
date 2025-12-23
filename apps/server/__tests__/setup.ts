import {
	cleanupDatabase,
	setupTestDatabase,
} from '@folionote/db/__tests__/utils/db-helper'
import { afterAll, afterEach, beforeAll } from 'vitest'

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
