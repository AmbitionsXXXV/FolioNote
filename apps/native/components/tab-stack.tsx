import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { Stack } from 'expo-router'
import { useThemeColor } from 'heroui-native'
import { useCallback } from 'react'
import { Platform, View } from 'react-native'
import { useAppTheme } from '@/contexts/app-theme-context'
import { ThemeToggle } from './theme-toggle'

/**
 * Shared Stack configuration for tab screens
 * Provides consistent header styling with Liquid Glass support
 *
 * Usage:
 * ```tsx
 * export default function TabLayout() {
 *   return (
 *     <TabStack>
 *       <TabStack.Screen name="index" options={{ title: 'Home' }} />
 *       <TabStack.Screen name="detail" options={{ title: 'Detail' }} />
 *     </TabStack>
 *   )
 * }
 * ```
 */
export function TabStack({ children }: { children?: React.ReactNode }) {
	const { isDark } = useAppTheme()
	const backgroundColor = useThemeColor('background')
	const foregroundColor = useThemeColor('foreground')

	const renderThemeToggle = useCallback(() => <ThemeToggle />, [])

	return (
		<View className="flex-1 bg-background">
			<Stack
				screenOptions={{
					headerTitleAlign: 'center',
					headerTransparent: true,
					headerBlurEffect: isDark ? 'dark' : 'light',
					headerTintColor: foregroundColor,
					headerTitleStyle: {
						fontFamily: 'Inter_600SemiBold',
					},
					headerStyle: {
						backgroundColor: Platform.select({
							ios: undefined,
							android: backgroundColor,
						}),
					},
					headerRight: renderThemeToggle,
					headerBackButtonDisplayMode: 'generic',
					gestureEnabled: true,
					gestureDirection: 'horizontal',
					fullScreenGestureEnabled: !isLiquidGlassAvailable(),
					contentStyle: {
						backgroundColor,
					},
				}}
			>
				{children}
			</Stack>
		</View>
	)
}

// Re-export Stack.Screen for convenience
TabStack.Screen = Stack.Screen
