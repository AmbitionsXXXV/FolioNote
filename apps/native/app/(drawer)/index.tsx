import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { Card, Chip, useThemeColor } from 'heroui-native'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { Container } from '@/components/container'
import { SignIn } from '@/components/sign-in'
import { SignUp } from '@/components/sign-up'
import { authClient } from '@/lib/auth-client'
import { orpc, queryClient } from '@/utils/orpc'

export default function Home() {
	const { t } = useTranslation()
	const healthCheck = useQuery(orpc.healthCheck.queryOptions())
	const privateData = useQuery(orpc.privateData.queryOptions())
	const isConnected = healthCheck?.data === 'OK'
	const isLoading = healthCheck?.isLoading
	const { data: session } = authClient.useSession()

	const mutedColor = useThemeColor('muted')
	const successColor = useThemeColor('success')
	const dangerColor = useThemeColor('danger')

	return (
		<Container className="p-6">
			<View className="mb-6 py-4">
				<Text className="mb-2 font-bold text-4xl text-foreground">FolioNote</Text>
			</View>

			{session?.user ? (
				<Card className="mb-6 p-4" variant="secondary">
					<Text className="mb-2 text-base text-foreground">
						{t('auth.welcome')},{' '}
						<Text className="font-medium">{session.user.name}</Text>
					</Text>
					<Text className="mb-4 text-muted text-sm">{session.user.email}</Text>
					<Pressable
						className="self-start rounded-lg bg-danger px-4 py-3 active:opacity-70"
						onPress={() => {
							authClient.signOut()
							queryClient.invalidateQueries()
						}}
					>
						<Text className="font-medium text-foreground">{t('auth.signOut')}</Text>
					</Pressable>
				</Card>
			) : null}

			<Card className="p-6" variant="secondary">
				<View className="mb-4 flex-row items-center justify-between">
					<Card.Title>System Status</Card.Title>
					<Chip
						color={isConnected ? 'success' : 'danger'}
						size="sm"
						variant="secondary"
					>
						<Chip.Label>{isConnected ? 'LIVE' : 'OFFLINE'}</Chip.Label>
					</Chip>
				</View>

				<Card className="p-4">
					<View className="flex-row items-center">
						<View
							className={`mr-3 h-3 w-3 rounded-full ${isConnected ? 'bg-success' : 'bg-muted'}`}
						/>
						<View className="flex-1">
							<Text className="mb-1 font-medium text-foreground">ORPC Backend</Text>
							<Card.Description>
								{(() => {
									if (isLoading) {
										return 'Checking connection...'
									}
									if (isConnected) {
										return 'Connected to API'
									}
									return 'API Disconnected'
								})()}
							</Card.Description>
						</View>
						{isLoading ? (
							<Ionicons color={mutedColor} name="hourglass-outline" size={20} />
						) : null}
						{!isLoading && isConnected ? (
							<Ionicons color={successColor} name="checkmark-circle" size={20} />
						) : null}
						{isLoading || isConnected ? null : (
							<Ionicons color={dangerColor} name="close-circle" size={20} />
						)}
					</View>
				</Card>
			</Card>

			<Card className="mt-6 p-4" variant="secondary">
				<Card.Title className="mb-3">Private Data</Card.Title>
				{privateData ? (
					<Card.Description>{privateData.data?.message}</Card.Description>
				) : null}
			</Card>

			{!session?.user && (
				<>
					<SignIn />
					<SignUp />
				</>
			)}
		</Container>
	)
}
