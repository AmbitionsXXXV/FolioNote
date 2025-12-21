import type { SupportedLanguage } from '@folio/locales'
import { defaultLanguage, getI18nConfig, parseAcceptLanguage } from '@folio/locales'
import i18next, { type i18n } from 'i18next'

let i18nInstance: i18n | null = null

export async function initI18n(): Promise<i18n> {
	if (i18nInstance) {
		return i18nInstance
	}

	const config = getI18nConfig()
	i18nInstance = i18next.createInstance()
	await i18nInstance.init(config)

	return i18nInstance
}

export function getI18nInstance(): i18n {
	if (!i18nInstance) {
		throw new Error('i18n not initialized. Call initI18n() first.')
	}
	return i18nInstance
}

export function getLocalizedMessage(
	key: string,
	locale: SupportedLanguage = defaultLanguage,
	params?: Record<string, unknown>
): string {
	const instance = getI18nInstance()
	return instance.t(key, { lng: locale, ...params })
}

export { parseAcceptLanguage }
export type { SupportedLanguage }
