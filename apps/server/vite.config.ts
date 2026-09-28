import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    name: "server",
    globals: true,
    environment: "node",
    testTimeout: 30_000,
    include: ["__tests__/**/*.test.ts", "**/*.spec.ts"],
    // Integration tests need a running database.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**",
      "__tests__/integration/**"
    ]
  },
  // `vp pack` wraps tsdown; options mirror the former tsdown.config.ts.
  pack: {
    entry: ["./src/index.ts", "./src/collab/index.ts"],
    format: "esm",
    outDir: "./dist",
    clean: true,
    // App build (run via `node dist/index.mjs`), not a published library —
    // no consumer imports its types, so skip declaration output. vp pack
    // enables dts by default, unlike the former tsdown config.
    dts: false,
    // Bundle all dependencies into the output (zero-dependency deployment).
    deps: {
      alwaysBundle: [/.*/],
      // Exclude Node.js built-in modules and native modules that can't be bundled.
      neverBundle: [/^node:/, "fsevents"],
      onlyBundle: false,
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true
    }
  }
})
