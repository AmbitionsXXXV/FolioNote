import type { SupportedLanguage } from '@folio/locales'
import { defaultLanguage, enUS, zhCN } from '@folio/locales'

type ErrorKey = keyof typeof enUS.error

const errorResources: Record<SupportedLanguage, Record<ErrorKey, string>> = {
	'en-US': enUS.error,
	'zh-CN': zhCN.error,
}

function interpolate(
	template: string,
	params?: Record<string, string | number>
): string {
	if (!params) {
		return template
	}

	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		const value = params[key]
		return value !== undefined ? String(value) : `{{${key}}}`
	})
}

export function getLocalizedErrorMessage(
	key: ErrorKey,
	locale: SupportedLanguage = defaultLanguage,
	params?: Record<string, string | number>
): string {
	const resources = errorResources[locale] ?? errorResources[defaultLanguage]
	const template = resources[key] ?? errorResources[defaultLanguage][key] ?? key
	return interpolate(template, params)
}

export type LocalizedError = {
	code: string
	message: string
	params?: Record<string, string | number>
}

export function createLocalizedError(
	code: string,
	key: ErrorKey,
	locale: SupportedLanguage = defaultLanguage,
	params?: Record<string, string | number>
): LocalizedError {
	return {
		code,
		message: getLocalizedErrorMessage(key, locale, params),
		...(params && { params }),
	}
}
