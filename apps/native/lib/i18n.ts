import type { SupportedLanguage } from '@folio/locales'
import { getI18nConfig, supportedLanguages } from '@folio/locales'
import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

function getDeviceLanguage(): SupportedLanguage {
	const locales = Localization.getLocales()
	const deviceLocale = locales[0]?.languageTag

	if (!deviceLocale) {
		return 'en-US'
	}

	const normalizedLocale = deviceLocale.toLowerCase()

	if (normalizedLocale.startsWith('zh')) {
		return 'zh-CN'
	}
	if (normalizedLocale.startsWith('en')) {
		return 'en-US'
	}

	for (const lang of supportedLanguages) {
		if (normalizedLocale.startsWith(lang.toLowerCase().split('-')[0])) {
			return lang
		}
	}

	return 'en-US'
}

const deviceLanguage = getDeviceLanguage()
const config = getI18nConfig(deviceLanguage)

i18n.use(initReactI18next).init(config)

export { i18n }
