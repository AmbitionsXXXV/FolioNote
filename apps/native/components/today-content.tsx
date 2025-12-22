import { useThemeColor } from 'heroui-native'
import { RefreshControl, ScrollView } from 'react-native'
import { QuickStatsCard } from './quick-stats-card'
import { TodayHeader } from './today-header'
import { TodayReviewCard } from './today-review-card'

type TodayContentProps = {
	userName: string
	streak: number
	dueToday: number
	overdue: number
	reviewedToday: number
	newCount: number
	totalEntries: number
	starredEntries: number
	unreviewedEntries: number
	isRefetching: boolean
	onRefresh: () => void
	onStartReview: () => void
}

export function TodayContent({
	userName,
	streak,
	dueToday,
	overdue,
	reviewedToday,
	newCount,
	totalEntries,
	starredEntries,
	unreviewedEntries,
	isRefetching,
	onRefresh,
	onStartReview,
}: TodayContentProps) {
	const accentColor = useThemeColor('accent')

	const totalDue = overdue + dueToday
	const hasItemsToReview = totalDue > 0 || newCount > 0

	return (
		<ScrollView
			contentContainerStyle={{ padding: 16, flexGrow: 1 }}
			refreshControl={
				<RefreshControl
					onRefresh={onRefresh}
					refreshing={isRefetching}
					tintColor={accentColor}
				/>
			}
		>
			<TodayHeader streak={streak} userName={userName} />

			<TodayReviewCard
				dueToday={dueToday}
				hasItemsToReview={hasItemsToReview}
				newCount={newCount}
				onStartReview={onStartReview}
				overdue={overdue}
				reviewedToday={reviewedToday}
				totalDue={totalDue}
			/>

			<QuickStatsCard
				starredEntries={starredEntries}
				totalEntries={totalEntries}
				unreviewedEntries={unreviewedEntries}
			/>
		</ScrollView>
	)
}
