import { PlayIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { Card } from 'heroui-native'
import { useTranslation } from 'react-i18next'
import { Pressable, Text } from 'react-native'
import { TodayStatsGrid } from './today-stats-grid'

type TodayReviewCardProps = {
	dueToday: number
	overdue: number
	reviewedToday: number
	newCount: number
	hasItemsToReview: boolean
	totalDue: number
	onStartReview: () => void
}

export function TodayReviewCard({
	dueToday,
	overdue,
	reviewedToday,
	newCount,
	hasItemsToReview,
	totalDue,
	onStartReview,
}: TodayReviewCardProps) {
	const { t } = useTranslation()

	const buttonText = hasItemsToReview
		? t('review.dueCount', { count: totalDue || newCount })
		: t('review.allCompleted')

	return (
		<Card className="mb-4 p-4" variant="secondary">
			<Text className="mb-4 font-semibold text-foreground text-lg">
				{t('review.today')}
			</Text>

			<TodayStatsGrid
				dueToday={dueToday}
				newCount={newCount}
				overdue={overdue}
				reviewedToday={reviewedToday}
			/>

			<Pressable
				className="flex-row items-center justify-center rounded-lg bg-accent p-4 active:opacity-70"
				disabled={!hasItemsToReview}
				onPress={onStartReview}
				style={{ opacity: hasItemsToReview ? 1 : 0.5 }}
			>
				<HugeiconsIcon color="white" icon={PlayIcon} size={20} />
				<Text className="ml-2 font-semibold text-white">{buttonText}</Text>
			</Pressable>
		</Card>
	)
}
