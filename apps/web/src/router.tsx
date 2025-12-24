import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { DefaultErrorBoundary } from './components/error-boundary'
import Loader from './components/loader'
import { NotFound } from './components/not-found'
import './index.css'
import { routeTree } from './routeTree.gen'
import { orpc, queryClient } from './utils/orpc'

export const getRouter = () => {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		// 预加载配置
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 0,
		// 设置最小加载延迟，避免快速加载时的闪烁
		defaultPendingMinMs: 200,
		// 设置加载超时后才显示 pending 组件
		defaultPendingMs: 150,
		context: { orpc, queryClient },
		defaultPendingComponent: () => <Loader />,
		defaultNotFoundComponent: () => <NotFound />,
		defaultErrorComponent: DefaultErrorBoundary,
		Wrap: ({ children }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	})
	return router
}

declare module '@tanstack/react-router' {
	// @ts-expect-error
	type Register = {
		router: ReturnType<typeof getRouter>
	}
}
