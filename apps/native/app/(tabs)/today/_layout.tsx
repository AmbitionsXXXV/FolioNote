import { useTranslation } from 'react-i18next'
import { TabStack } from '@/components/tab-stack'

export default function TodayLayout() {
	const { t } = useTranslation()

	return (
		<TabStack>
			<TabStack.Screen name="index" options={{ title: t('review.today') }} />
		</TabStack>
	)
}
