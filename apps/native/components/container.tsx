import { cn } from 'heroui-native'
import type { PropsWithChildren } from 'react'
import { ScrollView, View, type ViewProps } from 'react-native'
import Animated, { type AnimatedProps } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const AnimatedView = Animated.createAnimatedComponent(View)

type Props = AnimatedProps<ViewProps> & {
	className?: string
	/**
	 * When true, disables the internal ScrollView.
	 * Use this when the container contains a FlatList or other VirtualizedList.
	 */
	disableScroll?: boolean
	/**
	 * When true, disables the top safe area padding.
	 * Use this when the screen has a transparent header that handles its own insets.
	 */
	disableTopInset?: boolean
}

export function Container({
	children,
	className,
	disableScroll = false,
	disableTopInset = false,
	...props
}: PropsWithChildren<Props>) {
	const insets = useSafeAreaInsets()

	return (
		<AnimatedView
			className={cn('flex-1 bg-background', className)}
			style={{
				paddingBottom: insets.bottom,
				paddingTop: disableTopInset ? 0 : insets.top,
			}}
			{...props}
		>
			{disableScroll ? (
				children
			) : (
				<ScrollView contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView>
			)}
		</AnimatedView>
	)
}
