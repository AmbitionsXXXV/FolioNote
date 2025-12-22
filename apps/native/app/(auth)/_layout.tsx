import { Stack } from 'expo-router'
import { useThemeColor } from 'heroui-native'

export default function AuthLayout() {
	const backgroundColor = useThemeColor('background')

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor },
			}}
		>
			<Stack.Screen name="onboarding" />
			<Stack.Screen name="sign-in" />
			<Stack.Screen name="sign-up" />
		</Stack>
	)
}
