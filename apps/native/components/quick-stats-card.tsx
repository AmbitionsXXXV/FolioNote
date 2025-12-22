import {
	DocumentAttachmentIcon,
	StarIcon,
	ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { Card, useThemeColor } from 'heroui-native'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

type QuickStatsCardProps = {
	totalEntries: number
	starredEntries: number
	unreviewedEntries: number
}

export function QuickStatsCard({
	totalEntries,
	starredEntries,
	unreviewedEntries,
}: QuickStatsCardProps) {
	const { t } = useTranslation()
	const mutedColor = useThemeColor('muted')
	const warningColor = useThemeColor('warning')

	return (
		<Card className="p-4" variant="secondary">
			<Text className="mb-4 font-semibold text-foreground text-lg">
				{t('common.other')}
			</Text>

			<View className="space-y-3">
				<View className="flex-row items-center justify-between py-2">
					<View className="flex-row items-center">
						<HugeiconsIcon
							color={mutedColor}
							icon={DocumentAttachmentIcon}
							size={20}
						/>
						<Text className="ml-3 text-foreground">
							{t('review.statsTotalEntries')}
						</Text>
					</View>
					<Text className="font-medium text-foreground">{totalEntries}</Text>
				</View>

				<View className="flex-row items-center justify-between border-divider border-t py-2">
					<View className="flex-row items-center">
						<HugeiconsIcon color={warningColor} icon={StarIcon} size={20} />
						<Text className="ml-3 text-foreground">
							{t('review.statsStarredEntries')}
						</Text>
					</View>
					<Text className="font-medium text-foreground">{starredEntries}</Text>
				</View>

				<View className="flex-row items-center justify-between border-divider border-t py-2">
					<View className="flex-row items-center">
						<HugeiconsIcon color={mutedColor} icon={ViewOffIcon} size={20} />
						<Text className="ml-3 text-foreground">
							{t('review.statsUnreviewedEntries')}
						</Text>
					</View>
					<Text className="font-medium text-foreground">{unreviewedEntries}</Text>
				</View>
			</View>
		</Card>
	)
}
