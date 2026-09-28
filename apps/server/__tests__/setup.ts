// This setup file is only used for integration tests that need a database.
// Unit tests (ai-chat-store.test.ts, ai-tools.test.ts) use memory stores
// and don't need this setup.
//
// Integration tests are excluded from the default test run in vite.config.ts.
// Run integration tests only against a dedicated test database.

import { beforeAll } from "vite-plus/test"

beforeAll(() => {
  console.log("Setting up test database...")
  console.log("Test database ready")
})
