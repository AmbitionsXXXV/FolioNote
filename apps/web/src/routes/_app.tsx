import {
	ClientOnly,
	createFileRoute,
	Outlet,
	redirect,
	useRouterState,
} from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AppSidebar } from '@/components/app-sidebar'
import Loader from '@/components/loader'
import { MobileHeader } from '@/components/mobile-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getUser } from '@/functions/get-user'

export const Route = createFileRoute('/_app')({
	// 布局路由使用 data-only 模式：服务端执行 beforeLoad 进行认证检查
	// 但组件渲染在客户端进行，避免 hydration 问题
	ssr: 'data-only',

	// beforeLoad 在服务端执行认证检查
	beforeLoad: async () => {
		const session = await getUser()
		if (!session) {
			throw redirect({ to: '/login' })
		}
		return { session }
	},

	component: AppLayout,
})

/**
 * 页面过渡动画组件 - 仅在客户端渲染
 */
function AnimatedOutlet() {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname

	return (
		<AnimatePresence initial={false} mode="wait">
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -8 }}
				initial={{ opacity: 0, y: 8 }}
				key={currentPath}
				transition={{
					duration: 0.2,
					ease: [0.25, 0.1, 0.25, 1],
				}}
			>
				<Outlet />
			</motion.div>
		</AnimatePresence>
	)
}

/**
 * App layout with sidebar for authenticated product pages.
 * This layout wraps all product pages (inbox, library, tags, etc.)
 */
function AppLayout() {
	return (
		<SidebarProvider>
			{/* Desktop Sidebar - hidden on mobile */}
			<AppSidebar />

			{/* Main Content Area */}
			<SidebarInset>
				{/* Mobile Header - visible only on mobile, inside SidebarInset */}
				<MobileHeader />

				<main className="flex-1">
					{/* 使用 ClientOnly 确保动画只在客户端渲染，避免 hydration 问题 */}
					<ClientOnly fallback={<Loader />}>
						<AnimatedOutlet />
					</ClientOnly>
				</main>
			</SidebarInset>
		</SidebarProvider>
	)
}
