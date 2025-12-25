import type { InitOptions } from 'i18next'
import enUS from './resources/en-US.json' with { type: 'json' }
import jaJP from './resources/ja-JP.json' with { type: 'json' }
import zhCN from './resources/zh-CN.json' with { type: 'json' }

// ============================================
// Language configuration
// Add a new language only in this section
// ============================================
const languageConfig = {
	'en-US': {
		resource: enUS,
		match: ['en-US', 'en'],
	},
	'zh-CN': {
		resource: zhCN,
		match: ['zh-CN', 'zh'],
	},
	'ja-JP': {
		resource: jaJP,
		match: ['ja-JP', 'ja'],
	},
	// Future-safe:
	// 'zh-TW': { resource: zhTW, match: ['zh-TW'] },
	// 'zh-HK': { resource: zhHK, match: ['zh-HK'] },
} as const

// ============================================
// Types and constants derived from configuration
// ============================================
export type SupportedLanguage = keyof typeof languageConfig

export const supportedLanguages = Object.keys(languageConfig) as SupportedLanguage[]

export const defaultLanguage: SupportedLanguage = 'en-US'

export const fallbackLng = defaultLanguage

export const defaultNS = 'translation'

// Build i18next resources object from languageConfig
export const resources = Object.fromEntries(
	Object.entries(languageConfig).map(([lang, config]) => [
		lang,
		{ translation: config.resource },
	])
) as {
	[K in SupportedLanguage]: {
		translation: (typeof languageConfig)[K]['resource']
	}
}

// ============================================
// i18next configuration helper
// ============================================
export const getI18nConfig = (lng?: string): InitOptions => ({
	resources,
	lng: lng ?? defaultLanguage,
	fallbackLng,
	defaultNS,
	interpolation: {
		escapeValue: false,
	},
})

// ============================================
// Parse Accept-Language header
// ============================================
export function parseAcceptLanguage(header: string | null): SupportedLanguage {
	if (!header) {
		return defaultLanguage
	}

	const parsed = header
		.split(',')
		.map((lang) => {
			const [code, qValue] = lang.trim().split(';q=')

			return {
				code: code?.toLowerCase() ?? '',
				q: qValue ? Number.parseFloat(qValue) : 1,
			}
		})
		.filter((l) => l.code)
		.sort((a, b) => b.q - a.q)

	// 1. Exact match first (highest priority)
	for (const { code } of parsed) {
		if (code in languageConfig) {
			return code as SupportedLanguage
		}
	}

	// 2. Configured fallback match (ordered)
	for (const { code } of parsed) {
		for (const [lang, config] of Object.entries(languageConfig)) {
			if (
				config.match.some(
					(m) => code === m.toLowerCase() || code.startsWith(`${m.toLowerCase()}-`)
				)
			) {
				return lang as SupportedLanguage
			}
		}
	}

	return defaultLanguage
}

// Export raw resources for backward compatibility
export { enUS, jaJP, zhCN }
