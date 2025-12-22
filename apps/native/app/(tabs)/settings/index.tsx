import { LANGUAGE_LABELS } from '@folio/constants'
import { type SupportedLanguage, supportedLanguages } from '@folio/locales'
import {
	ArrowRight01Icon,
	Logout03Icon,
	Moon02Icon,
	Sun03Icon,
	Tick02Icon,
	TranslationIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import Constants from 'expo-constants'
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import { router } from 'expo-router'
import { Card, Switch, useThemeColor } from 'heroui-native'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	ActivityIndicator,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	Text,
	View,
} from 'react-native'
import Animated, { ZoomIn } from 'react-native-reanimated'
import { Container } from '@/components/container'
import { useAppTheme } from '@/contexts/app-theme-context'
import { authClient } from '@/lib/auth-client'

export default function SettingsScreen() {
	const { t, i18n } = useTranslation()
	const { data: session } = authClient.useSession()
	const { isLight, toggleTheme } = useAppTheme()
	const [languageModalVisible, setLanguageModalVisible] = useState(false)
	const [isSigningOut, setIsSigningOut] = useState(false)

	const foregroundColor = useThemeColor('foreground')
	const mutedColor = useThemeColor('muted')
	const accentColor = useThemeColor('accent')
	const accentForegroundColor = useThemeColor('accent-foreground')
	const dangerColor = useThemeColor('danger')
	const infoColor = useThemeColor('default')

	const currentLanguage = i18n.language as SupportedLanguage

	const handleLanguageChange = useCallback(
		(lang: SupportedLanguage) => {
			if (Platform.OS === 'ios') {
				impactAsync(ImpactFeedbackStyle.Light)
			}
			i18n.changeLanguage(lang)
			setLanguageModalVisible(false)
		},
		[i18n]
	)

	const handleThemeToggle = useCallback(() => {
		if (Platform.OS === 'ios') {
			impactAsync(ImpactFeedbackStyle.Light)
		}
		toggleTheme()
	}, [toggleTheme])

	const handleSignOut = useCallback(async () => {
		if (Platform.OS === 'ios') {
			impactAsync(ImpactFeedbackStyle.Medium)
		}
		setIsSigningOut(true)
		try {
			await authClient.signOut()
			router.replace('/(auth)/sign-in')
		} catch {
			// Handle error silently
		} finally {
			setIsSigningOut(false)
		}
	}, [])

	return (
		<Container className="flex-1">
			<ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
				{/* User Info */}
				{session?.user && (
					<Card className="mb-6 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-12 items-center justify-center rounded-full bg-accent">
								<Text className="font-bold text-lg text-white">
									{session.user.name?.charAt(0).toUpperCase() ?? 'U'}
								</Text>
							</View>
							<View className="flex-1">
								<Text className="font-semibold text-foreground text-lg">
									{session.user.name ?? t('common.other')}
								</Text>
								<Text className="text-muted text-sm">{session.user.email}</Text>
							</View>
						</View>
					</Card>
				)}

				{/* Appearance Section */}
				<Text className="mb-3 font-semibold text-foreground text-lg">
					{t('common.theme')}
				</Text>

				<Pressable onPress={handleThemeToggle}>
					<Card className="mb-3 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-10 items-center justify-center rounded-lg bg-accent/10">
								<HugeiconsIcon
									color={accentColor}
									icon={isLight ? Sun03Icon : Moon02Icon}
									size={24}
								/>
							</View>
							<View className="flex-1">
								<Text className="font-medium text-foreground">
									{t('common.theme')}
								</Text>
								<Text className="text-muted text-sm">
									{isLight ? t('common.themeLight') : t('common.themeDark')}
								</Text>
							</View>
							<Switch
								animation={{
									backgroundColor: {
										value: [mutedColor, accentColor],
									},
								}}
								className="h-[32px] w-[56px]"
								isSelected={isLight}
								onSelectedChange={handleThemeToggle}
							>
								<Switch.Thumb
									animation={{
										left: {
											value: 4,
											springConfig: {
												damping: 30,
												stiffness: 300,
												mass: 1,
											},
										},
									}}
									className="size-[22px]"
								/>
								<Switch.StartContent className="left-2">
									{isLight && (
										<Animated.View entering={ZoomIn.springify()} key="sun">
											<HugeiconsIcon
												color={accentForegroundColor}
												icon={Sun03Icon}
												size={16}
											/>
										</Animated.View>
									)}
								</Switch.StartContent>
								<Switch.EndContent className="right-2">
									{!isLight && (
										<Animated.View entering={ZoomIn.springify()} key="moon">
											<HugeiconsIcon color={infoColor} icon={Moon02Icon} size={16} />
										</Animated.View>
									)}
								</Switch.EndContent>
							</Switch>
						</View>
					</Card>
				</Pressable>

				{/* Language Section */}
				<Text className="mt-4 mb-3 font-semibold text-foreground text-lg">
					{t('common.language')}
				</Text>

				<Pressable onPress={() => setLanguageModalVisible(true)}>
					<Card className="mb-3 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-10 items-center justify-center rounded-lg bg-success/10">
								<HugeiconsIcon
									color={useThemeColor('success')}
									icon={TranslationIcon}
									size={24}
								/>
							</View>
							<View className="flex-1">
								<Text className="font-medium text-foreground">
									{t('common.language')}
								</Text>
								<Text className="text-muted text-sm">
									{LANGUAGE_LABELS[currentLanguage]}
								</Text>
							</View>
							<HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
						</View>
					</Card>
				</Pressable>

				{/* Account Section */}
				{session?.user && (
					<>
						<Text className="mt-4 mb-3 font-semibold text-foreground text-lg">
							{t('auth.signOut')}
						</Text>

						<Pressable disabled={isSigningOut} onPress={handleSignOut}>
							<Card className="mb-3 p-4" variant="secondary">
								<View className="flex-row items-center">
									<View className="mr-3 size-10 items-center justify-center rounded-lg bg-danger/10">
										<HugeiconsIcon
											color={dangerColor}
											icon={Logout03Icon}
											size={24}
										/>
									</View>
									<View className="flex-1">
										<Text className="font-medium text-danger">
											{t('auth.signOut')}
										</Text>
									</View>
									{isSigningOut && (
										<ActivityIndicator color={dangerColor} size="small" />
									)}
								</View>
							</Card>
						</Pressable>
					</>
				)}

				{/* App Info */}
				<View className="mt-auto items-center pt-8">
					<Text className="text-muted text-sm">FolioNote</Text>
					<Text className="text-muted text-xs">
						v{Constants.expoConfig?.version}
					</Text>
				</View>
			</ScrollView>

			{/* Language Selection Modal */}
			<Modal
				animationType="fade"
				onRequestClose={() => setLanguageModalVisible(false)}
				transparent
				visible={languageModalVisible}
			>
				<Pressable
					className="flex-1 items-center justify-center bg-black/50"
					onPress={() => setLanguageModalVisible(false)}
				>
					<Pressable
						className="mx-6 w-72 rounded-2xl bg-surface p-4"
						onPress={(e) => e.stopPropagation()}
					>
						<Text className="mb-4 text-center font-semibold text-foreground text-lg">
							{t('common.language')}
						</Text>

						{supportedLanguages.map((lang) => (
							<Pressable
								className="flex-row items-center justify-between rounded-xl px-4 py-3"
								key={lang}
								onPress={() => handleLanguageChange(lang)}
								style={{
									backgroundColor:
										currentLanguage === lang ? accentColor : 'transparent',
								}}
							>
								<Text
									className="text-base"
									style={{
										color: foregroundColor,
										fontWeight: currentLanguage === lang ? '600' : '400',
									}}
								>
									{LANGUAGE_LABELS[lang]}
								</Text>
								{currentLanguage === lang && (
									<HugeiconsIcon
										color={foregroundColor}
										icon={Tick02Icon}
										size={20}
									/>
								)}
							</Pressable>
						))}

						<Pressable
							className="mt-4 items-center rounded-xl py-3"
							onPress={() => setLanguageModalVisible(false)}
							style={{ backgroundColor: `${mutedColor}20` }}
						>
							<Text className="font-medium" style={{ color: foregroundColor }}>
								{t('common.close')}
							</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</Container>
	)
}
