import { Loading02FreeIcons } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion } from 'motion/react'

/**
 * 页面加载指示器
 * 使用 Motion 提供平滑的淡入效果，避免闪烁
 */
export default function Loader() {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="flex h-full min-h-[200px] items-center justify-center"
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.15, delay: 0.1 }}
		>
			<motion.div
				animate={{ rotate: 360 }}
				transition={{
					duration: 1,
					repeat: Number.POSITIVE_INFINITY,
					ease: 'linear',
				}}
			>
				<HugeiconsIcon
					className="text-primary/60"
					icon={Loading02FreeIcons}
					size={28}
				/>
			</motion.div>
		</motion.div>
	)
}

/**
 * 内联加载指示器（用于按钮等小区域）
 */
export function InlineLoader({ size = 16 }: { size?: number }) {
	return (
		<motion.div
			animate={{ rotate: 360 }}
			transition={{
				duration: 0.8,
				repeat: Number.POSITIVE_INFINITY,
				ease: 'linear',
			}}
		>
			<HugeiconsIcon
				className="text-current"
				icon={Loading02FreeIcons}
				size={size}
			/>
		</motion.div>
	)
}
