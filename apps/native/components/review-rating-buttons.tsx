import {
	FlashIcon,
	HelpCircleIcon,
	RefreshIcon,
	Tick01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { useThemeColor } from 'heroui-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

type Rating = 'again' | 'hard' | 'good' | 'easy'

type ReviewRatingButtonsProps = {
	onRating: (rating: Rating) => void
	isPending: boolean
}

export function ReviewRatingButtons({
	onRating,
	isPending,
}: ReviewRatingButtonsProps) {
	const { t } = useTranslation()
	const accentColor = useThemeColor('accent')
	const successColor = useThemeColor('success')
	const dangerColor = useThemeColor('danger')
	const warningColor = useThemeColor('warning')

	return (
		<View className="mt-4">
			<View className="flex-row justify-between">
				{/* Again */}
				<Pressable
					className="mr-2 flex-1 items-center rounded-lg bg-danger/10 p-4 active:opacity-70"
					disabled={isPending}
					onPress={() => onRating('again')}
				>
					<HugeiconsIcon color={dangerColor} icon={RefreshIcon} size={24} />
					<Text className="mt-1 font-medium text-danger text-sm">
						{t('review.again')}
					</Text>
				</Pressable>

				{/* Hard */}
				<Pressable
					className="mr-2 flex-1 items-center rounded-lg bg-warning/10 p-4 active:opacity-70"
					disabled={isPending}
					onPress={() => onRating('hard')}
				>
					<HugeiconsIcon color={warningColor} icon={HelpCircleIcon} size={24} />
					<Text className="mt-1 font-medium text-sm text-warning">
						{t('review.hard')}
					</Text>
				</Pressable>

				{/* Good */}
				<Pressable
					className="mr-2 flex-1 items-center rounded-lg bg-success/10 p-4 active:opacity-70"
					disabled={isPending}
					onPress={() => onRating('good')}
				>
					<HugeiconsIcon color={successColor} icon={Tick01Icon} size={24} />
					<Text className="mt-1 font-medium text-sm text-success">
						{t('review.good')}
					</Text>
				</Pressable>

				{/* Easy */}
				<Pressable
					className="flex-1 items-center rounded-lg bg-accent/10 p-4 active:opacity-70"
					disabled={isPending}
					onPress={() => onRating('easy')}
				>
					<HugeiconsIcon color={accentColor} icon={FlashIcon} size={24} />
					<Text className="mt-1 font-medium text-accent text-sm">
						{t('review.easy')}
					</Text>
				</Pressable>
			</View>

			{isPending && (
				<View className="absolute inset-0 items-center justify-center rounded-lg bg-background/80">
					<ActivityIndicator color={accentColor} />
				</View>
			)}
		</View>
	)
}
