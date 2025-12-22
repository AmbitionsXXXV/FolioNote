import {
	AlertCircleIcon,
	Calendar03Icon,
	CheckmarkCircle02Icon,
	SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { useThemeColor } from 'heroui-native'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

type TodayStatsGridProps = {
	dueToday: number
	overdue: number
	reviewedToday: number
	newCount: number
}

export function TodayStatsGrid({
	dueToday,
	overdue,
	reviewedToday,
	newCount,
}: TodayStatsGridProps) {
	const { t } = useTranslation()
	const accentColor = useThemeColor('accent')
	const mutedColor = useThemeColor('muted')
	const successColor = useThemeColor('success')
	const dangerColor = useThemeColor('danger')

	return (
		<View className="mb-4 flex-row flex-wrap">
			{/* Due Today */}
			<View className="w-1/2 p-2">
				<View className="rounded-lg bg-surface p-3">
					<View className="mb-2 flex-row items-center">
						<HugeiconsIcon color={accentColor} icon={Calendar03Icon} size={20} />
						<Text className="ml-2 text-muted text-sm">{t('review.dueToday')}</Text>
					</View>
					<Text className="font-bold text-2xl text-foreground">{dueToday}</Text>
				</View>
			</View>

			{/* Overdue */}
			<View className="w-1/2 p-2">
				<View className="rounded-lg bg-surface p-3">
					<View className="mb-2 flex-row items-center">
						<HugeiconsIcon color={dangerColor} icon={AlertCircleIcon} size={20} />
						<Text className="ml-2 text-muted text-sm">{t('review.overdue')}</Text>
					</View>
					<Text className="font-bold text-2xl text-danger">{overdue}</Text>
				</View>
			</View>

			{/* Reviewed Today */}
			<View className="w-1/2 p-2">
				<View className="rounded-lg bg-surface p-3">
					<View className="mb-2 flex-row items-center">
						<HugeiconsIcon
							color={successColor}
							icon={CheckmarkCircle02Icon}
							size={20}
						/>
						<Text className="ml-2 text-muted text-sm">{t('review.completed')}</Text>
					</View>
					<Text className="font-bold text-2xl text-success">{reviewedToday}</Text>
				</View>
			</View>

			{/* New Items */}
			<View className="w-1/2 p-2">
				<View className="rounded-lg bg-surface p-3">
					<View className="mb-2 flex-row items-center">
						<HugeiconsIcon color={mutedColor} icon={SparklesIcon} size={20} />
						<Text className="ml-2 text-muted text-sm">{t('review.newItems')}</Text>
					</View>
					<Text className="font-bold text-2xl text-foreground">{newCount}</Text>
				</View>
			</View>
		</View>
	)
}
