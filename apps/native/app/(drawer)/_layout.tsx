import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { useThemeColor } from 'heroui-native'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { SettingsButton } from '@/components/settings-button'
import { ThemeToggle } from '@/components/theme-toggle'

function DrawerLayout() {
	const { t } = useTranslation()
	const themeColorForeground = useThemeColor('foreground')
	const themeColorBackground = useThemeColor('background')

	const renderHeaderRight = useCallback(
		() => (
			<View className="flex-row items-center">
				<SettingsButton />
				<ThemeToggle />
			</View>
		),
		[]
	)

	return (
		<Drawer
			screenOptions={{
				headerTintColor: themeColorForeground,
				headerStyle: { backgroundColor: themeColorBackground },
				headerTitleStyle: {
					fontWeight: '600',
					color: themeColorForeground,
				},
				headerRight: renderHeaderRight,
				drawerStyle: { backgroundColor: themeColorBackground },
			}}
		>
			<Drawer.Screen
				name="index"
				options={{
					headerTitle: t('nav.home'),
					drawerLabel: ({ color, focused }) => (
						<Text style={{ color: focused ? color : themeColorForeground }}>
							{t('nav.home')}
						</Text>
					),
					drawerIcon: ({ size, color, focused }) => (
						<Ionicons
							color={focused ? color : themeColorForeground}
							name="home-outline"
							size={size}
						/>
					),
				}}
			/>
			<Drawer.Screen
				name="(tabs)"
				options={{
					headerTitle: t('nav.dashboard'),
					drawerLabel: ({ color, focused }) => (
						<Text style={{ color: focused ? color : themeColorForeground }}>
							{t('nav.dashboard')}
						</Text>
					),
					drawerIcon: ({ size, color, focused }) => (
						<MaterialIcons
							color={focused ? color : themeColorForeground}
							name="border-bottom"
							size={size}
						/>
					),
					headerRight: () => (
						<Link asChild href="/modal">
							<Pressable className="mr-4">
								<Ionicons
									color={themeColorForeground}
									name="add-outline"
									size={24}
								/>
							</Pressable>
						</Link>
					),
				}}
			/>
		</Drawer>
	)
}

export default DrawerLayout
