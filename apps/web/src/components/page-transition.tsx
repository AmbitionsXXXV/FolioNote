import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

type PageTransitionProps = {
	children: ReactNode
	className?: string
}

/**
 * 页面过渡动画包装组件
 * 使用 Motion 提供平滑的淡入淡出和缩放效果
 */
export function PageTransition({ children, className }: PageTransitionProps) {
	return (
		<motion.div
			animate={{ opacity: 1, y: 0, scale: 1 }}
			className={className}
			exit={{ opacity: 0, y: -8, scale: 0.99 }}
			initial={{ opacity: 0, y: 8, scale: 0.99 }}
			transition={{
				duration: 0.25,
				ease: [0.25, 0.1, 0.25, 1],
			}}
		>
			{children}
		</motion.div>
	)
}

/**
 * 带有 AnimatePresence 的页面过渡容器
 * 用于在路由切换时提供退出动画
 */
export function PageTransitionContainer({
	children,
	routeKey,
}: {
	children: ReactNode
	routeKey: string
}) {
	return (
		<AnimatePresence initial={false} mode="wait">
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -10 }}
				initial={{ opacity: 0, y: 10 }}
				key={routeKey}
				transition={{
					duration: 0.2,
					ease: [0.25, 0.1, 0.25, 1],
				}}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	)
}

/**
 * 骨架屏加载状态组件
 * 提供更好的加载体验，避免白屏闪烁
 */
export function PageSkeleton() {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="container mx-auto max-w-5xl px-4 py-8"
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.15 }}
		>
			{/* Header skeleton */}
			<div className="mb-8 flex items-center gap-3">
				<div className="size-10 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-2">
					<div className="h-6 w-32 animate-pulse rounded bg-muted" />
					<div className="h-4 w-48 animate-pulse rounded bg-muted" />
				</div>
			</div>

			{/* Content skeleton */}
			<div className="space-y-4">
				<div className="h-24 animate-pulse rounded-xl bg-muted" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div className="h-32 animate-pulse rounded-xl bg-muted" />
					<div
						className="h-32 animate-pulse rounded-xl bg-muted"
						style={{ animationDelay: '50ms' }}
					/>
					<div
						className="h-32 animate-pulse rounded-xl bg-muted"
						style={{ animationDelay: '100ms' }}
					/>
				</div>
			</div>
		</motion.div>
	)
}
