import type { InitOptions } from 'i18next'
import enUS from './resources/en-US.json'
import zhCN from './resources/zh-CN.json'

export const resources = {
	'en-US': { translation: enUS },
	'zh-CN': { translation: zhCN },
} as const

export const supportedLanguages = ['en-US', 'zh-CN'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

export const defaultLanguage: SupportedLanguage = 'en-US'

export const fallbackLng = defaultLanguage

export const defaultNS = 'translation'

export const getI18nConfig = (lng?: string): InitOptions => ({
	resources,
	lng: lng ?? defaultLanguage,
	fallbackLng,
	defaultNS,
	interpolation: {
		escapeValue: false,
	},
})

export function parseAcceptLanguage(header: string | null): SupportedLanguage {
	if (!header) {
		return defaultLanguage
	}

	const languages = header
		.split(',')
		.map((lang) => {
			const [code, qValue] = lang.trim().split(';q=')
			return {
				code: code.trim(),
				q: qValue ? Number.parseFloat(qValue) : 1,
			}
		})
		.sort((a, b) => b.q - a.q)

	for (const { code } of languages) {
		const normalizedCode = code.toLowerCase()

		if (normalizedCode.startsWith('zh')) {
			return 'zh-CN'
		}
		if (normalizedCode.startsWith('en')) {
			return 'en-US'
		}
	}

	return defaultLanguage
}

export { enUS, zhCN }
