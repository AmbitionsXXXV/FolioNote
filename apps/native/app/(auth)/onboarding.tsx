import {
	Book02Icon,
	CloudIcon,
	NoteEditIcon,
	RefreshIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react-native'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { router } from 'expo-router'
import { useThemeColor } from 'heroui-native'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Container } from '@/components/container'

export default function OnboardingScreen() {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const accentColor = useThemeColor('accent')

	const handleSignIn = useCallback(() => {
		router.push('/(auth)/sign-in')
	}, [])

	const handleSignUp = useCallback(() => {
		router.push('/(auth)/sign-up')
	}, [])

	return (
		<Container className="flex-1">
			<View
				className="flex-1 justify-between"
				style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
			>
				{/* Hero Section */}
				<View className="flex-1 items-center justify-center px-8">
					{/* Logo / Icon */}
					<View className="mb-8 h-24 w-24 items-center justify-center rounded-3xl bg-accent/10">
						<HugeiconsIcon color={accentColor} icon={Book02Icon} size={48} />
					</View>

					{/* App Name */}
					<Text className="mb-3 text-center font-bold text-4xl text-foreground">
						FolioNote
					</Text>

					{/* Tagline */}
					<Text className="mb-8 px-4 text-center text-lg text-muted">
						{t('onboarding.tagline', {
							defaultValue: 'Smart note-taking with spaced repetition',
						})}
					</Text>

					{/* Features */}
					<View className="w-full max-w-sm">
						<FeatureItem
							accentColor={accentColor}
							description={t('onboarding.feature1Desc', {
								defaultValue: 'Write and organize your notes effortlessly',
							})}
							icon={NoteEditIcon}
							title={t('onboarding.feature1', { defaultValue: 'Capture Ideas' })}
						/>
						<FeatureItem
							accentColor={accentColor}
							description={t('onboarding.feature2Desc', {
								defaultValue: 'Use spaced repetition to remember forever',
							})}
							icon={RefreshIcon}
							title={t('onboarding.feature2', { defaultValue: 'Review & Learn' })}
						/>
						<FeatureItem
							accentColor={accentColor}
							description={t('onboarding.feature3Desc', {
								defaultValue: 'Access your notes anywhere, anytime',
							})}
							icon={CloudIcon}
							title={t('onboarding.feature3', { defaultValue: 'Sync Everywhere' })}
						/>
					</View>
				</View>

				{/* Action Buttons */}
				<View className="px-6 pb-4">
					{/* Sign Up Button (Primary) */}
					<Pressable
						className="mb-3 flex-row items-center justify-center rounded-xl bg-accent p-4 active:opacity-80"
						onPress={handleSignUp}
					>
						<Text className="font-semibold text-lg text-white">
							{t('auth.createAccount')}
						</Text>
					</Pressable>

					{/* Sign In Button (Secondary) */}
					<Pressable
						className="flex-row items-center justify-center rounded-xl border border-divider bg-surface p-4 active:opacity-80"
						onPress={handleSignIn}
					>
						<Text className="font-semibold text-foreground text-lg">
							{t('auth.signIn')}
						</Text>
					</Pressable>
				</View>
			</View>
		</Container>
	)
}

function FeatureItem({
	icon,
	title,
	description,
	accentColor,
}: {
	icon: IconSvgElement
	title: string
	description: string
	accentColor: string
}) {
	return (
		<View className="mb-4 flex-row items-start">
			<View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-accent/10">
				<HugeiconsIcon color={accentColor} icon={icon} size={20} />
			</View>
			<View className="flex-1">
				<Text className="mb-1 font-semibold text-foreground">{title}</Text>
				<Text className="text-muted text-sm">{description}</Text>
			</View>
		</View>
	)
}
