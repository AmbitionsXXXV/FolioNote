import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	plugins: [tsconfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
	server: {
		port: 3001,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					// React core
					if (
						id.includes('node_modules/react/') ||
						id.includes('node_modules/react-dom/')
					) {
						return 'react-vendor'
					}
					// TanStack Router
					if (id.includes('node_modules/@tanstack/react-router')) {
						return 'tanstack-router'
					}
					// TanStack Query
					if (id.includes('node_modules/@tanstack/react-query')) {
						return 'tanstack-query'
					}
					// Tiptap editor
					if (
						id.includes('node_modules/@tiptap/') ||
						id.includes('node_modules/prosemirror-')
					) {
						return 'tiptap'
					}
					// Shiki (syntax highlighting)
					if (
						id.includes('node_modules/shiki') ||
						id.includes('node_modules/@shikijs')
					) {
						return 'shiki'
					}
					// Tippy.js
					if (
						id.includes('node_modules/tippy.js') ||
						id.includes('node_modules/@popperjs')
					) {
						return 'tippy'
					}
					// Motion
					if (id.includes('node_modules/motion')) {
						return 'motion'
					}
				},
			},
		},
	},
})
