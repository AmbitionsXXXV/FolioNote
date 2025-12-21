import { getI18nConfig } from '@folio/locales'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const config = getI18nConfig()

i18n.use(initReactI18next).init({
	...config,
	detection: {
		order: ['localStorage', 'navigator'],
		caches: ['localStorage'],
	},
})

export default i18n
