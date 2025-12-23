import { useTranslation } from 'react-i18next'
import { TabStack } from '@/components/tab-stack'

export default function InboxLayout() {
	const { t } = useTranslation()

	return (
		<TabStack>
			<TabStack.Screen name="index" options={{ title: t('nav.inbox') }} />
			<TabStack.Screen
				name="[id]"
				options={{
					title: t('entry.detail'),
					presentation: 'card',
				}}
			/>
		</TabStack>
	)
}
