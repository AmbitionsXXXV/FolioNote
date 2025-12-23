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
	ScrollView,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Container } from '@/components/container'
import { authClient } from '@/lib/auth-client'
import { queryClient } from '@/utils/orpc'

export default function SignUpScreen() {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const mutedColor = useThemeColor('muted')
	const foregroundColor = useThemeColor('foreground')

	const handleBack = useCallback(() => {
		router.back()
	}, [])

	const handleSignUp = useCallback(async () => {
		if (!(name.trim() && email.trim() && password.trim())) {
			setError(t('auth.fillAllFields'))
			return
		}

		if (password.length < 8) {
			setError(t('auth.passwordTooShort'))
			return
		}

		setIsLoading(true)
		setError(null)

		await authClient.signUp.email(
			{
				name: name.trim(),
				email: email.trim(),
				password,
			},
			{
				onError(signUpError) {
					setError(signUpError.error?.message || t('auth.signUpFailed'))
					setIsLoading(false)
				},
				onSuccess() {
					setName('')
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
	}, [name, email, password, t])

	const navigateToSignIn = useCallback(() => {
		router.replace('/(auth)/sign-in')
	}, [])

	return (
		<Container className="flex-1">
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				className="flex-1"
			>
				<ScrollView
					className="flex-1"
					contentContainerStyle={{
						flexGrow: 1,
						paddingHorizontal: 24,
						paddingTop: insets.top,
						paddingBottom: insets.bottom + 16,
					}}
					keyboardShouldPersistTaps="handled"
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
							{t('auth.createAccount')}
						</Text>
					</View>

					{/* Form */}
					<View className="flex-1">
						{/* Welcome Text */}
						<Text className="mb-2 font-semibold text-foreground text-xl">
							{t('auth.getStarted')}
						</Text>
						<Text className="mb-8 text-muted">{t('auth.signUpSubtitle')}</Text>

						{/* Error Message */}
						{error ? (
							<View className="mb-4 rounded-xl bg-danger/10 p-4">
								<Text className="text-danger text-sm">{error}</Text>
							</View>
						) : null}

						{/* Name Input */}
						<View className="mb-4">
							<Text className="mb-2 font-medium text-foreground text-sm">
								{t('auth.name')}
							</Text>
							<TextInput
								autoCapitalize="words"
								autoComplete="name"
								className="rounded-xl border border-divider bg-surface p-4 text-foreground"
								onChangeText={setName}
								placeholder={t('auth.namePlaceholder')}
								placeholderTextColor={mutedColor}
								value={name}
							/>
						</View>

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
								placeholder={t('auth.emailPlaceholder', {
									defaultValue: 'Enter your email',
								})}
								placeholderTextColor={mutedColor}
								value={email}
							/>
						</View>

						{/* Password Input */}
						<View className="mb-2">
							<Text className="mb-2 font-medium text-foreground text-sm">
								{t('auth.password')}
							</Text>
							<TextInput
								autoCapitalize="none"
								autoComplete="password-new"
								className="rounded-xl border border-divider bg-surface p-4 text-foreground"
								onChangeText={setPassword}
								onSubmitEditing={handleSignUp}
								placeholder={t('auth.passwordPlaceholder', {
									defaultValue: 'Create a password',
								})}
								placeholderTextColor={mutedColor}
								returnKeyType="done"
								secureTextEntry
								value={password}
							/>
						</View>

						{/* Password Hint */}
						<Text className="mb-6 text-muted text-xs">{t('auth.passwordHint')}</Text>

						{/* Sign Up Button */}
						<Pressable
							className="mb-4 flex-row items-center justify-center rounded-xl bg-accent p-4 active:opacity-80"
							disabled={isLoading}
							onPress={handleSignUp}
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							{isLoading ? (
								<ActivityIndicator color="white" size="small" />
							) : (
								<Text className="font-semibold text-lg text-white">
									{t('auth.signUp')}
								</Text>
							)}
						</Pressable>

						{/* Sign In Link */}
						<View className="flex-row items-center justify-center">
							<Text className="text-muted">{t('auth.haveAccount')} </Text>
							<Button onPress={navigateToSignIn}>
								<Text className="font-semibold text-accent">{t('auth.signIn')}</Text>
							</Button>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Container>
	)
}
