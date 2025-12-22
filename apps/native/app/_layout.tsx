import '@/global.css'

import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	Inter_700Bold,
	useFonts,
} from '@expo-google-fonts/inter'
import { QueryClientProvider } from '@tanstack/react-query'

import { Stack } from 'expo-router'
import { HeroUINativeProvider } from 'heroui-native'
import { I18nextProvider } from 'react-i18next'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { AppThemeProvider } from '@/contexts/app-theme-context'
import { authClient } from '@/lib/auth-client'
import { i18n } from '@/lib/i18n'

import { queryClient } from '@/utils/orpc'

export const unstable_settings = {
	initialRouteName: '(auth)',
}

/**
 * Protected Routes Navigator
 * Uses Stack.Protected for declarative route guarding (SDK 53+)
 * - Automatically handles deep link protection
 * - Navigates automatically when auth state changes
 */
function StackLayout() {
	const { data: session, isPending } = authClient.useSession()
	const isAuthenticated = !!session?.user

	// Show loading while checking auth state
	if (isPending) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" />
			</View>
		)
	}

	return (
		<Stack screenOptions={{}}>
			{/* Protected routes for authenticated users */}
			<Stack.Protected guard={isAuthenticated}>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="modal"
					options={{ title: 'Modal', presentation: 'modal' }}
				/>
			</Stack.Protected>

			{/* Protected routes for unauthenticated users */}
			<Stack.Protected guard={!isAuthenticated}>
				<Stack.Screen name="(auth)" options={{ headerShown: false }} />
			</Stack.Protected>
		</Stack>
	)
}

export default function Layout() {
	const fonts = useFonts({
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
		Inter_700Bold,
	})

	if (!fonts) {
		return null
	}

	return (
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<GestureHandlerRootView style={{ flex: 1 }}>
					<KeyboardProvider>
						<AppThemeProvider>
							<HeroUINativeProvider>
								<StackLayout />
							</HeroUINativeProvider>
						</AppThemeProvider>
					</KeyboardProvider>
				</GestureHandlerRootView>
			</QueryClientProvider>
		</I18nextProvider>
	)
}
