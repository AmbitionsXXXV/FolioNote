import { Clock01Icon, PinIcon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { Card, useThemeColor } from 'heroui-native'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'

type Entry = {
	id: string
	title: string | null
	contentText: string | null
	contentJson: string | null
	isStarred: boolean | null
	isPinned: boolean | null
	createdAt: Date
	updatedAt: Date
}

type ReviewCardProps = {
	entry: Entry
}

function formatDate(date: Date): string {
	return new Date(date).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

export function ReviewCard({ entry }: ReviewCardProps) {
	const { t } = useTranslation()
	const mutedColor = useThemeColor('muted')
	const warningColor = useThemeColor('warning')
	const accentColor = useThemeColor('accent')

	const title = entry.title || t('entryCard.untitled')
	const content = entry.contentText || t('entryCard.emptyNote')

	return (
		<Card className="flex-1 p-4" variant="secondary">
			{/* Header */}
			<View className="mb-4 flex-row items-center justify-between border-divider border-b pb-4">
				<View className="flex-1 flex-row items-center">
					{entry.isPinned && (
						<View className="mr-2">
							<HugeiconsIcon color={accentColor} icon={PinIcon} size={16} />
						</View>
					)}
					<Text
						className="flex-1 font-semibold text-foreground text-lg"
						numberOfLines={2}
					>
						{title}
					</Text>
					{entry.isStarred && (
						<View className="ml-2">
							<HugeiconsIcon color={warningColor} icon={StarIcon} size={20} />
						</View>
					)}
				</View>
			</View>

			{/* Content */}
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ paddingBottom: 16 }}
				showsVerticalScrollIndicator={false}
			>
				<Text className="text-base text-foreground leading-6">{content}</Text>
			</ScrollView>

			{/* Footer */}
			<View className="mt-4 flex-row items-center border-divider border-t pt-4">
				<HugeiconsIcon color={mutedColor} icon={Clock01Icon} size={14} />
				<Text className="ml-1 text-muted text-xs">
					{t('entry.updatedAt')}: {formatDate(entry.updatedAt)}
				</Text>
			</View>
		</Card>
	)
}
