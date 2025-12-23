import {
	AddCircleIcon,
	AlertCircleIcon,
	ArrowRight01Icon,
	Calendar03Icon,
	Mail01Icon,
	RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Card, useThemeColor } from 'heroui-native'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from 'react-native'
import { Container } from '@/components/container'
import { authClient } from '@/lib/auth-client'
import { orpc } from '@/utils/orpc'

// Get timezone offset in minutes
function getTzOffset(): number {
	return -new Date().getTimezoneOffset()
}

export default function HomeScreen() {
	const { t } = useTranslation()
	const { data: session } = authClient.useSession()
	const healthCheck = useQuery(orpc.healthCheck.queryOptions())

	const accentColor = useThemeColor('accent')
	const mutedColor = useThemeColor('muted')
	const successColor = useThemeColor('success')
	const warningColor = useThemeColor('warning')

	// Fetch stats if logged in
	const {
		data: dueStats,
		isLoading: isLoadingStats,
		refetch: refetchStats,
		isRefetching: isRefetchingStats,
	} = useQuery({
		...orpc.review.getDueStats.queryOptions({ input: { tzOffset: getTzOffset() } }),
		enabled: !!session?.user,
	})

	const isConnected = healthCheck?.data === 'OK'
	const isLoading = healthCheck?.isLoading

	const handleRefresh = useCallback(() => {
		healthCheck.refetch()
		if (session?.user) {
			refetchStats()
		}
	}, [healthCheck, session?.user, refetchStats])

	const navigateToInbox = useCallback(() => {
		router.push('/inbox' as never)
	}, [])

	const navigateToToday = useCallback(() => {
		router.push('/today' as never)
	}, [])

	const navigateToReview = useCallback(() => {
		router.push('/review' as never)
	}, [])

	const totalDue = (dueStats?.overdue ?? 0) + (dueStats?.dueToday ?? 0)

	return (
		<Container className="flex-1">
			<ScrollView
				contentContainerStyle={{ padding: 16, flexGrow: 1 }}
				refreshControl={
					<RefreshControl
						onRefresh={handleRefresh}
						refreshing={isRefetchingStats}
						tintColor={accentColor}
					/>
				}
			>
				{/* Header */}
				<View className="mb-6">
					<Text className="mb-1 font-bold text-3xl text-foreground">FolioNote</Text>
					<View className="flex-row items-center">
						<View
							className={`mr-2 h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`}
						/>
						<Text className="text-muted text-sm">
							{(() => {
								if (isLoading) return t('home.connecting')
								if (isConnected) return t('home.systemReady')
								return t('home.offline')
							})()}
						</Text>
					</View>
				</View>

				{/* Welcome Section */}
				<Card className="mb-4 p-4" variant="secondary">
					<Text className="mb-2 font-semibold text-foreground text-lg">
						{session?.user
							? `${t('auth.welcome')}, ${session.user.name?.split(' ')[0] ?? ''}`
							: t('home.welcomePersonal')}
					</Text>
					<Text className="text-muted text-sm">
						{session?.user ? t('home.subtitleUser') : t('home.subtitleGuest')}
					</Text>
				</Card>

				{/* Quick Stats for logged in users */}
				{session?.user && !isLoadingStats && (
					<View className="mb-4 flex-row">
						{/* Due Today */}
						<Pressable className="mr-2 flex-1" onPress={navigateToReview}>
							<Card className="p-4" variant="secondary">
								<View className="mb-2 flex-row items-center">
									<HugeiconsIcon
										color={accentColor}
										icon={Calendar03Icon}
										size={20}
									/>
									<Text className="ml-2 text-muted text-xs">
										{t('review.dueToday')}
									</Text>
								</View>
								<Text className="font-bold text-2xl text-foreground">
									{dueStats?.dueToday ?? 0}
								</Text>
							</Card>
						</Pressable>

						{/* Total Due */}
						<Pressable className="flex-1" onPress={navigateToReview}>
							<Card className="p-4" variant="secondary">
								<View className="mb-2 flex-row items-center">
									<HugeiconsIcon
										color={warningColor}
										icon={AlertCircleIcon}
										size={20}
									/>
									<Text className="ml-2 text-muted text-xs">
										{t('review.statsDueEntries')}
									</Text>
								</View>
								<Text className="font-bold text-2xl text-foreground">
									{totalDue}
								</Text>
							</Card>
						</Pressable>
					</View>
				)}

				{/* Quick Actions */}
				<Text className="mb-3 font-semibold text-foreground">
					{t('home.quickActions')}
				</Text>

				{/* New Entry */}
				<Pressable onPress={navigateToInbox}>
					<Card className="mb-3 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-12 items-center justify-center rounded-lg bg-accent/10">
								<HugeiconsIcon color={accentColor} icon={AddCircleIcon} size={24} />
							</View>
							<View className="flex-1">
								<Text className="font-medium text-foreground">
									{t('entry.newEntry')}
								</Text>
								<Text className="text-muted text-sm">
									{t('home.actionDescription.newEntry')}
								</Text>
							</View>
							<HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
						</View>
					</Card>
				</Pressable>

				{/* Inbox */}
				<Pressable onPress={navigateToInbox}>
					<Card className="mb-3 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-12 items-center justify-center rounded-lg bg-success/10">
								<HugeiconsIcon color={successColor} icon={Mail01Icon} size={24} />
							</View>
							<View className="flex-1">
								<Text className="font-medium text-foreground">{t('nav.inbox')}</Text>
								<Text className="text-muted text-sm">
									{t('home.actionDescription.inbox')}
								</Text>
							</View>
							<HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
						</View>
					</Card>
				</Pressable>

				{/* Today */}
				<Pressable onPress={navigateToToday}>
					<Card className="mb-3 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-12 items-center justify-center rounded-lg bg-warning/10">
								<HugeiconsIcon
									color={warningColor}
									icon={Calendar03Icon}
									size={24}
								/>
							</View>
							<View className="flex-1">
								<Text className="font-medium text-foreground">
									{t('review.today')}
								</Text>
								<Text className="text-muted text-sm">
									{t('review.dueEntriesDescription')}
								</Text>
							</View>
							<HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
						</View>
					</Card>
				</Pressable>

				{/* Review */}
				<Pressable onPress={navigateToReview}>
					<Card className="mb-3 p-4" variant="secondary">
						<View className="flex-row items-center">
							<View className="mr-3 size-12 items-center justify-center rounded-lg bg-muted/10">
								<HugeiconsIcon color={mutedColor} icon={RefreshIcon} size={24} />
							</View>
							<View className="flex-1">
								<Text className="font-medium text-foreground">
									{t('nav.review')}
								</Text>
								<Text className="text-muted text-sm">{t('review.description')}</Text>
							</View>
							<HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
						</View>
					</Card>
				</Pressable>

				{/* Loading indicator for stats */}
				{session?.user && isLoadingStats && (
					<View className="items-center py-4">
						<ActivityIndicator color={accentColor} />
					</View>
				)}
			</ScrollView>
		</Container>
	)
}
