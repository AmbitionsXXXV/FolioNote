import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * 定义代码分割的 chunk 映射规则
 * 每个规则包含一个或多个匹配模式和对应的 chunk 名称
 */
const chunkRules: Array<{ patterns: string[]; chunk: string }> = [
	// React core
	{
		patterns: ['node_modules/react/', 'node_modules/react-dom/'],
		chunk: 'react-vendor',
	},
	// TanStack Router
	{ patterns: ['node_modules/@tanstack/react-router'], chunk: 'tanstack-router' },
	// TanStack Query
	{ patterns: ['node_modules/@tanstack/react-query'], chunk: 'tanstack-query' },
	// Tiptap editor
	{
		patterns: ['node_modules/@tiptap/', 'node_modules/prosemirror-'],
		chunk: 'tiptap',
	},
	// Shiki (syntax highlighting)
	{ patterns: ['node_modules/shiki', 'node_modules/@shikijs'], chunk: 'shiki' },
	// Tippy.js
	{ patterns: ['node_modules/tippy.js', 'node_modules/@popperjs'], chunk: 'tippy' },
	// Motion
	{ patterns: ['node_modules/motion'], chunk: 'motion' },
	// Drizzle ORM (pg-core 优先匹配)
	// { patterns: ['node_modules/drizzle-orm/pg-core'], chunk: 'drizzle-orm-pg-core' },
	// { patterns: ['node_modules/drizzle-orm/'], chunk: 'drizzle-orm' },
	// Utilities
	{ patterns: ['node_modules/nanoid'], chunk: 'nanoid' },
	{ patterns: ['node_modules/zod'], chunk: 'zod' },
	{ patterns: ['node_modules/i18next'], chunk: 'i18next' },
]

/**
 * 根据模块 ID 返回对应的 chunk 名称
 */
function getChunkName(id: string): string | undefined {
	for (const rule of chunkRules) {
		if (rule.patterns.some((pattern) => id.includes(pattern))) {
			return rule.chunk
		}
	}
	return undefined
}

export default defineConfig({
	plugins: [
		tsconfigPaths(),
		tailwindcss(),
		cloudflare({ viteEnvironment: { name: 'ssr' } }),
		tanstackStart(),
		viteReact(),
	],
	server: {
		port: 3001,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: getChunkName,
			},
		},
	},
})
