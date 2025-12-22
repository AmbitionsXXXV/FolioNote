import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
	LockIcon,
	PlayIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, useThemeColor } from 'heroui-native'
import { useCallback, useState } from 'react'
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
import { ReviewCard } from '@/components/review-card'
import { ReviewRatingButtons } from '@/components/review-rating-buttons'
import { ReviewRuleCard } from '@/components/review-rule-card'
import { authClient } from '@/lib/auth-client'
import { client, orpc, queryClient } from '@/utils/orpc'

// Get timezone offset in minutes
function getTzOffset(): number {
	return -new Date().getTimezoneOffset()
}

type ReviewRule = 'due' | 'new' | 'starred' | 'unreviewed' | 'all'
type Rating = 'again' | 'hard' | 'good' | 'easy'

function ReviewSessionView({
	entries,
	currentIndex,
	onEndReview,
	onRating,
	isPending,
}: {
	entries: Array<{
		id: string
		title: string | null
		contentText: string | null
		contentJson: string | null
		isStarred: boolean | null
		isPinned: boolean | null
		createdAt: Date
		updatedAt: Date
	}>
	currentIndex: number
	onEndReview: () => void
	onRating: (rating: Rating) => void
	isPending: boolean
}) {
	const { t } = useTranslation()
	const mutedColor = useThemeColor('muted')
	const currentEntry = entries[currentIndex]

	if (!currentEntry) return null

	return (
		<Container className="flex-1">
			<View className="flex-1 p-4">
				<View className="mb-4 flex-row items-center justify-between">
					<Pressable
						className="flex-row items-center active:opacity-70"
						onPress={onEndReview}
					>
						<HugeiconsIcon color={mutedColor} icon={Cancel01Icon} size={24} />
						<Text className="ml-2 text-muted">{t('review.endReview')}</Text>
					</Pressable>
					<Text className="text-muted">
						{currentIndex + 1} / {entries.length}
					</Text>
				</View>

				<View className="flex-1">
					<ReviewCard entry={currentEntry} />
				</View>

				<ReviewRatingButtons isPending={isPending} onRating={onRating} />
			</View>
		</Container>
	)
}

function ReviewCompletedView({
	reviewedCount,
	onDone,
}: {
	reviewedCount: number
	onDone: () => void
}) {
	const { t } = useTranslation()
	const successColor = useThemeColor('success')

	return (
		<Container className="flex-1 items-center justify-center p-6">
			<HugeiconsIcon color={successColor} icon={CheckmarkCircle02Icon} size={80} />
			<Text className="mt-4 text-center font-semibold text-2xl text-foreground">
				{t('review.greatJob')}
			</Text>
			<Text className="mt-2 text-center text-muted">
				{t('review.completedSession')}
			</Text>
			<Text className="mt-4 text-center text-muted">
				{t('review.reviewedTodayCount', { count: reviewedCount })}
			</Text>
			<Pressable
				className="mt-8 rounded-lg bg-accent px-8 py-4 active:opacity-70"
				onPress={onDone}
			>
				<Text className="font-medium text-white">{t('common.done')}</Text>
			</Pressable>
		</Container>
	)
}

export default function ReviewScreen() {
	const { t } = useTranslation()
	const { data: session } = authClient.useSession()
	const [currentRule, setCurrentRule] = useState<ReviewRule>('due')
	const [currentIndex, setCurrentIndex] = useState(0)
	const [isReviewing, setIsReviewing] = useState(false)

	const accentColor = useThemeColor('accent')
	const mutedColor = useThemeColor('muted')

	const {
		data: queueData,
		isLoading,
		refetch,
		isRefetching,
	} = useQuery({
		...orpc.review.getQueue.queryOptions({
			input: { rule: currentRule, limit: 50, tzOffset: getTzOffset() },
		}),
		enabled: !!session?.user,
	})

	const markReviewedMutation = useMutation({
		mutationFn: ({ entryId, rating }: { entryId: string; rating: Rating }) =>
			client.review.markReviewed({ entryId, rating }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['review'] })
			setCurrentIndex((prev) => prev + 1)
		},
	})

	const handleStartReview = useCallback(() => {
		setIsReviewing(true)
		setCurrentIndex(0)
	}, [])

	const handleEndReview = useCallback(() => {
		setIsReviewing(false)
		setCurrentIndex(0)
		refetch()
	}, [refetch])

	const handleRating = useCallback(
		(rating: Rating) => {
			const currentEntry = queueData?.items[currentIndex]
			if (currentEntry) {
				markReviewedMutation.mutate({ entryId: currentEntry.id, rating })
			}
		},
		[queueData?.items, currentIndex, markReviewedMutation]
	)

	const handleRuleChange = useCallback((rule: ReviewRule) => {
		setCurrentRule(rule)
		setCurrentIndex(0)
		setIsReviewing(false)
	}, [])

	if (!session?.user) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<HugeiconsIcon color={mutedColor} icon={LockIcon} size={64} />
				<Text className="mt-4 text-center text-lg text-muted">
					{t('error.unauthorized')}
				</Text>
			</Container>
		)
	}

	if (isLoading) {
		return (
			<Container className="flex-1 items-center justify-center">
				<ActivityIndicator color={accentColor} size="large" />
			</Container>
		)
	}

	const entries = queueData?.items ?? []
	const hasMoreEntries = currentIndex < entries.length
	const reviewedTodayCount = queueData?.reviewedTodayCount ?? 0

	if (isReviewing && hasMoreEntries) {
		return (
			<ReviewSessionView
				currentIndex={currentIndex}
				entries={entries}
				isPending={markReviewedMutation.isPending}
				onEndReview={handleEndReview}
				onRating={handleRating}
			/>
		)
	}

	if (isReviewing && !hasMoreEntries) {
		return (
			<ReviewCompletedView
				onDone={handleEndReview}
				reviewedCount={reviewedTodayCount + currentIndex}
			/>
		)
	}

	return (
		<Container className="flex-1">
			<ScrollView
				contentContainerStyle={{ padding: 16, flexGrow: 1 }}
				refreshControl={
					<RefreshControl
						onRefresh={refetch}
						refreshing={isRefetching}
						tintColor={accentColor}
					/>
				}
			>
				<View className="mb-6">
					<Text className="font-bold text-2xl text-foreground">
						{t('review.reviewQueue')}
					</Text>
					<Text className="mt-1 text-muted">{t('review.description')}</Text>
				</View>

				<Card className="mb-4 p-4" variant="secondary">
					<View className="flex-row items-center justify-between">
						<Text className="font-medium text-foreground">
							{t('review.statsReviewedToday')}
						</Text>
						<Text className="font-bold text-accent text-lg">
							{reviewedTodayCount}
						</Text>
					</View>
				</Card>

				<Text className="mb-3 font-semibold text-foreground">
					{t('review.selectMode')}
				</Text>

				<ReviewRuleCard
					description={t('review.dueEntriesDescription')}
					iconColorKey="accent"
					iconName="calendar"
					isSelected={currentRule === 'due'}
					onPress={() => handleRuleChange('due')}
					rule="due"
					title={t('review.dueEntries')}
				/>

				<ReviewRuleCard
					description={t('review.newEntriesDescription')}
					iconColorKey="success"
					iconName="sparkles"
					isSelected={currentRule === 'new'}
					onPress={() => handleRuleChange('new')}
					rule="new"
					title={t('review.newEntries')}
				/>

				<ReviewRuleCard
					description={t('review.starredEntriesDescription')}
					iconColorKey="warning"
					iconName="star"
					isSelected={currentRule === 'starred'}
					onPress={() => handleRuleChange('starred')}
					rule="starred"
					title={t('review.starredEntries')}
				/>

				<ReviewRuleCard
					description={t('review.allEntriesDescription')}
					iconColorKey="muted"
					iconName="albums"
					isSelected={currentRule === 'all'}
					onPress={() => handleRuleChange('all')}
					rule="all"
					title={t('review.allEntries')}
				/>

				<View className="mt-4">
					<Pressable
						className="flex-row items-center justify-center rounded-lg bg-accent p-4 active:opacity-70"
						disabled={entries.length === 0}
						onPress={handleStartReview}
						style={{ opacity: entries.length > 0 ? 1 : 0.5 }}
					>
						<HugeiconsIcon color="white" icon={PlayIcon} size={20} />
						<Text className="ml-2 font-semibold text-white">
							{entries.length > 0
								? `${t('review.reviewSession')} (${entries.length})`
								: t('review.noReviewItems')}
						</Text>
					</Pressable>
				</View>
			</ScrollView>
		</Container>
	)
}
