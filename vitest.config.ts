import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		testTimeout: 30_000,
		// Vitest 4.x: exclude patterns (only node_modules and .git excluded by default)
		exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			// Vitest 4.x: coverage.all removed, must define include explicitly
			include: ['**/src/**/*.{ts,tsx}'],
			exclude: [
				'**/node_modules/**',
				'**/__tests__/**',
				'**/*.test.{ts,tsx}',
				'**/*.spec.{ts,tsx}',
				'**/dist/**',
				'**/migrations/**',
				'**/*.d.ts',
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 75,
				statements: 80,
			},
		},
		projects: [
			{
				test: {
					name: 'server',
					root: './apps/server',
					environment: 'node',
					include: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
				},
			},
			{
				test: {
					name: 'web',
					root: './apps/web',
					environment: 'jsdom',
					include: ['**/__tests__/**/*.test.tsx', '**/*.spec.tsx'],
				},
			},
			{
				test: {
					name: 'native',
					root: './apps/native',
					environment: 'node',
					include: ['**/__tests__/**/*.test.tsx', '**/*.spec.tsx'],
				},
			},
			{
				test: {
					name: 'packages',
					root: './packages',
					environment: 'node',
					include: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
				},
			},
		],
	},
})
