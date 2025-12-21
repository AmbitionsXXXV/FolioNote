import { Ionicons } from '@expo/vector-icons'
import { type SupportedLanguage, supportedLanguages } from '@folio/locales'
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import { useThemeColor } from 'heroui-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Platform, Pressable, Text } from 'react-native'

const languageLabels: Record<SupportedLanguage, string> = {
	'en-US': 'English',
	'zh-CN': '简体中文',
}

export function SettingsButton() {
	const { t, i18n } = useTranslation()
	const [visible, setVisible] = useState(false)
	const foregroundColor = useThemeColor('foreground')
	const backgroundColor = useThemeColor('background')
	const surfaceColor = useThemeColor('surface')
	const accentColor = useThemeColor('accent')

	const currentLanguage = i18n.language as SupportedLanguage

	function handleLanguageChange(lang: SupportedLanguage) {
		if (Platform.OS === 'ios') {
			impactAsync(ImpactFeedbackStyle.Light)
		}
		i18n.changeLanguage(lang)
		setVisible(false)
	}

	return (
		<>
			<Pressable
				className="px-2.5"
				onPress={() => {
					if (Platform.OS === 'ios') {
						impactAsync(ImpactFeedbackStyle.Light)
					}
					setVisible(true)
				}}
			>
				<Ionicons color={foregroundColor} name="language" size={20} />
			</Pressable>

			<Modal
				animationType="fade"
				onRequestClose={() => setVisible(false)}
				transparent
				visible={visible}
			>
				<Pressable
					className="flex-1 items-center justify-center bg-black/50"
					onPress={() => setVisible(false)}
				>
					<Pressable
						className="mx-6 w-72 rounded-2xl p-4"
						onPress={(e) => e.stopPropagation()}
						style={{ backgroundColor: surfaceColor }}
					>
						<Text
							className="mb-4 text-center font-semibold text-lg"
							style={{ color: foregroundColor }}
						>
							{t('common.language')}
						</Text>

						{supportedLanguages.map((lang) => (
							<Pressable
								className="flex-row items-center justify-between rounded-xl px-4 py-3"
								key={lang}
								onPress={() => handleLanguageChange(lang)}
								style={{
									backgroundColor:
										currentLanguage === lang ? accentColor : 'transparent',
								}}
							>
								<Text
									className="text-base"
									style={{
										color: foregroundColor,
										fontWeight: currentLanguage === lang ? '600' : '400',
									}}
								>
									{languageLabels[lang]}
								</Text>
								{currentLanguage === lang && (
									<Ionicons color={foregroundColor} name="checkmark" size={20} />
								)}
							</Pressable>
						))}

						<Pressable
							className="mt-4 items-center rounded-xl py-3"
							onPress={() => setVisible(false)}
							style={{ backgroundColor }}
						>
							<Text className="font-medium" style={{ color: foregroundColor }}>
								{t('common.close')}
							</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	)
}
