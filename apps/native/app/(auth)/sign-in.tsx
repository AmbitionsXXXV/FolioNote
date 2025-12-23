import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { router } from 'expo-router'
import { Button, useThemeColor } from 'heroui-native'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Container } from '@/components/container'
import { authClient } from '@/lib/auth-client'
import { queryClient } from '@/utils/orpc'

export default function SignInScreen() {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const mutedColor = useThemeColor('muted')
	const foregroundColor = useThemeColor('foreground')

	const handleBack = useCallback(() => {
		router.back()
	}, [])

	const handleSignIn = useCallback(async () => {
		if (!(email.trim() && password.trim())) {
			setError(t('auth.fillAllFields'))
			return
		}

		setIsLoading(true)
		setError(null)

		await authClient.signIn.email(
			{
				email: email.trim(),
				password,
			},
			{
				onError(signInError) {
					setError(signInError.error?.message || t('auth.signInFailed'))
					setIsLoading(false)
				},
				onSuccess() {
					setEmail('')
					setPassword('')
					queryClient.refetchQueries()
					router.replace('/(tabs)/index')
				},
				onFinished() {
					setIsLoading(false)
				},
			}
		)
	}, [email, password, t])

	const navigateToSignUp = useCallback(() => {
		router.replace('/(auth)/sign-up')
	}, [])

	return (
		<Container className="flex-1">
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				className="flex-1"
			>
				<View
					className="flex-1 px-6"
					style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
				>
					{/* Header */}
					<View className="mb-8 flex-row items-center pt-4">
						<Pressable
							className="mr-4 size-10 items-center justify-center rounded-full active:opacity-70"
							onPress={handleBack}
						>
							<HugeiconsIcon
								color={foregroundColor}
								icon={ArrowLeft01Icon}
								size={24}
							/>
						</Pressable>
						<Text className="font-bold text-2xl text-foreground">
							{t('auth.signIn')}
						</Text>
					</View>

					{/* Form */}
					<View className="flex-1">
						{/* Welcome Text */}
						<Text className="mb-2 font-semibold text-foreground text-xl">
							{t('auth.welcomeBack')}
						</Text>
						<Text className="mb-8 text-muted">{t('auth.signInSubtitle')}</Text>

						{/* Error Message */}
						{error ? (
							<View className="mb-4 rounded-xl bg-danger/10 p-4">
								<Text className="text-danger text-sm">{error}</Text>
							</View>
						) : null}

						{/* Email Input */}
						<View className="mb-4">
							<Text className="mb-2 font-medium text-foreground text-sm">
								{t('auth.email')}
							</Text>
							<TextInput
								autoCapitalize="none"
								autoComplete="email"
								className="rounded-xl border border-divider bg-surface p-4 text-foreground"
								keyboardType="email-address"
								onChangeText={setEmail}
								placeholder={t('auth.emailPlaceholder')}
								placeholderTextColor={mutedColor}
								value={email}
							/>
						</View>

						{/* Password Input */}
						<View className="mb-6">
							<Text className="mb-2 font-medium text-foreground text-sm">
								{t('auth.password')}
							</Text>
							<TextInput
								autoCapitalize="none"
								autoComplete="password"
								className="rounded-xl border border-divider bg-surface p-4 text-foreground"
								onChangeText={setPassword}
								onSubmitEditing={handleSignIn}
								placeholder={t('auth.passwordPlaceholder')}
								placeholderTextColor={mutedColor}
								returnKeyType="done"
								secureTextEntry
								value={password}
							/>
						</View>

						{/* Sign In Button */}
						<Pressable
							className="mb-4 flex-row items-center justify-center rounded-xl bg-accent p-4 active:opacity-80"
							disabled={isLoading}
							onPress={handleSignIn}
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							{isLoading ? (
								<ActivityIndicator color="white" size="small" />
							) : (
								<Text className="font-semibold text-lg text-white">
									{t('auth.signIn')}
								</Text>
							)}
						</Pressable>

						{/* Sign Up Link */}
						<View className="flex-row items-center justify-center">
							<Text className="text-muted">{t('auth.noAccount')} </Text>
							<Button onPress={navigateToSignUp}>
								<Text className="font-semibold text-accent">{t('auth.signUp')}</Text>
							</Button>
						</View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Container>
	)
}
