import {
	Album01Icon,
	Calendar03Icon,
	CheckmarkCircle02Icon,
	SparklesIcon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react-native'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { Card, useThemeColor } from 'heroui-native'
import { Pressable, Text, View } from 'react-native'

type ReviewRule = 'due' | 'new' | 'starred' | 'unreviewed' | 'all'

type ReviewRuleCardProps = {
	rule: ReviewRule
	title: string
	description: string
	iconName: 'calendar' | 'sparkles' | 'star' | 'albums'
	iconColorKey: 'accent' | 'success' | 'warning' | 'muted'
	isSelected: boolean
	onPress: () => void
}

const iconMap: Record<string, IconSvgElement> = {
	calendar: Calendar03Icon,
	sparkles: SparklesIcon,
	star: StarIcon,
	albums: Album01Icon,
}

export function ReviewRuleCard({
	title,
	description,
	iconName,
	iconColorKey,
	isSelected,
	onPress,
}: ReviewRuleCardProps) {
	const accentColor = useThemeColor('accent')
	const successColor = useThemeColor('success')
	const warningColor = useThemeColor('warning')
	const mutedColor = useThemeColor('muted')

	const colorMap = {
		accent: accentColor,
		success: successColor,
		warning: warningColor,
		muted: mutedColor,
	}

	const iconColor = colorMap[iconColorKey]
	const bgColorClass = {
		accent: 'bg-accent/10',
		success: 'bg-success/10',
		warning: 'bg-warning/10',
		muted: 'bg-muted/10',
	}[iconColorKey]

	const IconComponent = iconMap[iconName] || Calendar03Icon

	return (
		<Pressable onPress={onPress}>
			<Card
				className={`mb-3 p-4 ${isSelected ? 'border-2 border-accent' : ''}`}
				variant="secondary"
			>
				<View className="flex-row items-center">
					<View
						className={`mr-3 h-10 w-10 items-center justify-center rounded-lg ${bgColorClass}`}
					>
						<HugeiconsIcon color={iconColor} icon={IconComponent} size={20} />
					</View>
					<View className="flex-1">
						<Text className="font-medium text-foreground">{title}</Text>
						<Text className="text-muted text-sm">{description}</Text>
					</View>
					{isSelected && (
						<HugeiconsIcon
							color={accentColor}
							icon={CheckmarkCircle02Icon}
							size={24}
						/>
					)}
				</View>
			</Card>
		</Pressable>
	)
}
