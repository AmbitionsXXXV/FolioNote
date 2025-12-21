import '@/global.css'

import { QueryClientProvider } from '@tanstack/react-query'

import { Stack } from 'expo-router'
import { HeroUINativeProvider } from 'heroui-native'
import { I18nextProvider } from 'react-i18next'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { AppThemeProvider } from '@/contexts/app-theme-context'
import { i18n } from '@/lib/i18n'

import { queryClient } from '@/utils/orpc'

export const unstable_settings = {
	initialRouteName: '(drawer)',
}

function StackLayout() {
	return (
		<Stack screenOptions={{}}>
			<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
			<Stack.Screen
				name="modal"
				options={{ title: 'Modal', presentation: 'modal' }}
			/>
		</Stack>
	)
}

export default function Layout() {
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
