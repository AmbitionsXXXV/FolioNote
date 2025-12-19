// Note: This is a placeholder setup file for database tests
// For SQLite in-memory tests, you would initialize a SQLite database here
// For PostgreSQL tests, you would use the TEST_DATABASE_URL

// Example SQLite setup (commented out - requires SQLite-compatible schema):
// import { Database } from 'bun:sqlite'
// import { drizzle } from 'drizzle-orm/bun-sqlite'
//
// let sqlite: Database
// let db: ReturnType<typeof drizzle>
//
// beforeAll(() => {
//   sqlite = new Database(':memory:')
//   db = drizzle(sqlite, { schema })
//   // Apply schema/migrations here
// })
//
// afterEach(async () => {
//   // Clean all tables between tests
// })
//
// afterAll(() => {
//   sqlite.close()
// })
//
// export { db }

// For now, export the PostgreSQL db for testing
// This will use the actual database connection
// biome-ignore lint/performance/noBarrelFile: Test setup file re-exports db for convenience
export { db } from '../src'
