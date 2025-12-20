import type { QueryClient } from '@tanstack/react-query'

import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { CommandPalette } from '@/components/command-palette'
import { Toaster } from '@/components/ui/sonner'
import { CommandPaletteProvider } from '@/contexts/command-palette-context'
import type { orpc } from '@/utils/orpc'
import Header from '../components/header'
import appCss from '../index.css?url'
export type RouterAppContext = {
	orpc: typeof orpc
	queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{
				title: 'FolioNote',
			},
		],
		links: [
			{
				rel: 'stylesheet',
				href: appCss,
			},
		],
	}),

	component: RootDocument,
})

function RootDocument() {
	return (
		<html className="dark no-scrollbar bg-background" lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="bg-background">
				<CommandPaletteProvider>
					<div className="relative z-10 grid h-svh grid-rows-[auto_1fr]">
						<div className="animate-fade-in delay-100">
							<Header />
						</div>
						<div className="animate-fade-in-scale delay-200">
							<Outlet />
						</div>
					</div>
					<div className="animate-fade-in delay-300">
						<CommandPalette />
					</div>
				</CommandPaletteProvider>
				<Toaster richColors />
				<TanStackRouterDevtools position="bottom-left" />
				<ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
				<Scripts />
			</body>
		</html>
	)
}
