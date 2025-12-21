import { Card, useThemeColor } from 'heroui-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { authClient } from '@/lib/auth-client'
import { queryClient } from '@/utils/orpc'

type SignUpHandlerParams = {
	name: string
	email: string
	password: string
	setError: (error: string | null) => void
	setIsLoading: (loading: boolean) => void
	setName: (name: string) => void
	setEmail: (email: string) => void
	setPassword: (password: string) => void
}

function signUpHandler({
	name,
	email,
	password,
	setError,
	setIsLoading,
	setName,
	setEmail,
	setPassword,
}: SignUpHandlerParams) {
	setIsLoading(true)
	setError(null)

	authClient.signUp.email(
		{
			name,
			email,
			password,
		},
		{
			onError(error) {
				setError(error.error?.message || 'Failed to sign up')
				setIsLoading(false)
			},
			onSuccess() {
				setName('')
				setEmail('')
				setPassword('')
				queryClient.refetchQueries()
			},
			onFinished() {
				setIsLoading(false)
			},
		}
	)
}

export function SignUp() {
	const { t } = useTranslation()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const mutedColor = useThemeColor('muted')
	const foregroundColor = useThemeColor('foreground')

	function handlePress() {
		signUpHandler({
			name,
			email,
			password,
			setError,
			setIsLoading,
			setName,
			setEmail,
			setPassword,
		})
	}

	return (
		<Card className="mt-6 p-4" variant="secondary">
			<Card.Title className="mb-4">{t('auth.createAccount')}</Card.Title>

			{error ? (
				<View className="mb-4 rounded-lg bg-danger/10 p-3">
					<Text className="text-danger text-sm">{error}</Text>
				</View>
			) : null}

			<TextInput
				className="mb-3 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
				onChangeText={setName}
				placeholder={t('auth.name')}
				placeholderTextColor={mutedColor}
				value={name}
			/>

			<TextInput
				autoCapitalize="none"
				className="mb-3 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
				keyboardType="email-address"
				onChangeText={setEmail}
				placeholder={t('auth.email')}
				placeholderTextColor={mutedColor}
				value={email}
			/>

			<TextInput
				className="mb-4 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
				onChangeText={setPassword}
				placeholder={t('auth.password')}
				placeholderTextColor={mutedColor}
				secureTextEntry
				value={password}
			/>

			<Pressable
				className="flex-row items-center justify-center rounded-lg bg-accent p-4 active:opacity-70"
				disabled={isLoading}
				onPress={handlePress}
			>
				{isLoading ? (
					<ActivityIndicator color={foregroundColor} size="small" />
				) : (
					<Text className="font-medium text-foreground">{t('auth.signUp')}</Text>
				)}
			</Pressable>
		</Card>
	)
}
