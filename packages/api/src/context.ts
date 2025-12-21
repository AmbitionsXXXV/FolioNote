import { auth } from '@folio/auth'
import { parseAcceptLanguage, type SupportedLanguage } from '@folio/locales'
import type { Context as HonoContext } from 'hono'

export type CreateContextOptions = {
	context: HonoContext
}

function resolveLocale(headers: Headers): SupportedLanguage {
	const xLocale = headers.get('X-Locale')
	if (xLocale) {
		const normalized = xLocale.toLowerCase()
		if (normalized.startsWith('zh')) {
			return 'zh-CN'
		}
		if (normalized.startsWith('en')) {
			return 'en-US'
		}
	}

	const acceptLanguage = headers.get('Accept-Language')
	return parseAcceptLanguage(acceptLanguage)
}

export async function createContext({ context }: CreateContextOptions) {
	const headers = context.req.raw.headers
	const session = await auth.api.getSession({ headers })
	const locale = resolveLocale(headers)

	return {
		session,
		locale,
	}
}

export type Context = Awaited<ReturnType<typeof createContext>>
