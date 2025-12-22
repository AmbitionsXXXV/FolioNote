import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import { useThemeColor } from 'heroui-native'
import { Platform, Pressable } from 'react-native'
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated'
import { useAppTheme } from '@/contexts/app-theme-context'

export function ThemeToggle() {
	const { toggleTheme, isLight } = useAppTheme()
	const foregroundColor = useThemeColor('foreground')

	return (
		<Pressable
			className="px-2.5"
			onPress={() => {
				if (Platform.OS === 'ios') {
					impactAsync(ImpactFeedbackStyle.Light)
				}
				toggleTheme()
			}}
		>
			{isLight ? (
				<Animated.View entering={ZoomIn} exiting={FadeOut} key="moon">
					<HugeiconsIcon color={foregroundColor} icon={Moon02Icon} size={20} />
				</Animated.View>
			) : (
				<Animated.View entering={ZoomIn} exiting={FadeOut} key="sun">
					<HugeiconsIcon color={foregroundColor} icon={Sun03Icon} size={20} />
				</Animated.View>
			)}
		</Pressable>
	)
}
