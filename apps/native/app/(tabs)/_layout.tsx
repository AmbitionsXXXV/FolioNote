import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'
import { useTranslation } from 'react-i18next'
import { DynamicColorIOS, Platform } from 'react-native'

/**
 * Native Tabs Layout with iOS 26 Liquid Glass support
 *
 * Features:
 * - Uses NativeTabs for native system tab bar
 * - SF Symbols for iOS icons (auto Liquid Glass on iOS 26+)
 * - DynamicColorIOS for automatic light/dark mode adaptation
 * - Bouncing transitions between routes (iOS)
 * - Automatic scroll-to-top behavior
 * - Each tab has its own Stack navigator for header support
 */
export default function TabLayout() {
	const { t } = useTranslation()

	// Dynamic colors for Liquid Glass compatibility
	// Liquid Glass automatically changes colors based on background
	const dynamicLabelColor =
		Platform.OS === 'ios'
			? DynamicColorIOS({ dark: 'white', light: 'black' })
			: undefined

	const dynamicTintColor =
		Platform.OS === 'ios'
			? DynamicColorIOS({ dark: 'white', light: 'black' })
			: undefined

	return (
		<NativeTabs
			labelStyle={{
				color: dynamicLabelColor,
			}}
			tintColor={dynamicTintColor}
		>
			<NativeTabs.Trigger name="index">
				<Label>{t('nav.home')}</Label>
				{/* SF Symbols: house / house.fill for iOS */}
				<Icon drawable="ic_home" sf={{ default: 'house', selected: 'house.fill' }} />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="inbox">
				<Label>{t('nav.inbox')}</Label>
				{/* SF Symbols: envelope / envelope.fill for iOS */}
				<Icon
					drawable="ic_mail"
					sf={{ default: 'envelope', selected: 'envelope.fill' }}
				/>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="today">
				<Label>{t('review.today')}</Label>
				{/* SF Symbols: calendar / calendar.circle.fill for iOS */}
				<Icon
					drawable="ic_calendar"
					sf={{ default: 'calendar', selected: 'calendar.circle.fill' }}
				/>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="review">
				<Label>{t('nav.review')}</Label>
				{/* SF Symbols: arrow.clockwise / arrow.clockwise.circle.fill for iOS */}
				<Icon
					drawable="ic_refresh"
					sf={{
						default: 'arrow.clockwise',
						selected: 'arrow.clockwise.circle.fill',
					}}
				/>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="settings">
				<Label>{t('common.settings')}</Label>
				{/* SF Symbols: gear / gearshape.fill for iOS */}
				<Icon
					drawable="ic_settings"
					sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
				/>
			</NativeTabs.Trigger>
		</NativeTabs>
	)
}
