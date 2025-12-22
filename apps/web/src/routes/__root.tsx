import type { QueryClient } from '@tanstack/react-query'

import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider } from 'next-themes'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { CommandPalette } from '@/components/command-palette'
import { Toaster } from '@/components/ui/sonner'
import { CommandPaletteProvider } from '@/contexts/command-palette-context'
import { useIsMobile } from '@/hooks/use-mobile'
import i18n from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { orpc } from '@/utils/orpc'
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

function RootDocumentInner() {
	const isMobile = useIsMobile()
	const { i18n: i18nInstance } = useTranslation()
	const currentLang = i18nInstance.language

	// Map language codes to CSS class names for font switching
	const getLangClass = (lang: string) => {
		if (lang.startsWith('zh')) return 'lang-zh'
		if (lang.startsWith('ja')) return 'lang-ja'
		return 'lang-en'
	}
	const langClass = getLangClass(currentLang)

	return (
		<html
			className={cn('no-scrollbar bg-background')}
			lang={currentLang}
			suppressHydrationWarning
		>
			<head>
				<HeadContent />
			</head>
			<body className={cn('min-h-svh bg-background', langClass)}>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					disableTransitionOnChange
					enableSystem
				>
					<CommandPaletteProvider>
						<Outlet />
						<CommandPalette />
					</CommandPaletteProvider>
					<Toaster richColors />
				</ThemeProvider>
				<TanStackRouterDevtools position={isMobile ? 'bottom-left' : 'top-right'} />
				<ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
				<Scripts />
			</body>
		</html>
	)
}

function RootDocument() {
	return (
		<I18nextProvider i18n={i18n}>
			<RootDocumentInner />
		</I18nextProvider>
	)
}
