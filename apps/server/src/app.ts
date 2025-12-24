import { createContext } from '@folionote/api/context'
import { appRouter } from '@folionote/api/routers/index'
import { auth } from '@folionote/auth'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timeout } from 'hono/timeout'

import type { Env } from './env'

const trailingSlashesPattern = /\/+$/

export type { Env }

export function createApp(env?: Env) {
	const app = new Hono<{ Bindings: Env }>()

	function normalizeCorsOriginValue(raw: string): string {
		const trimmed = raw.trim()
		if (!trimmed) {
			return ''
		}
		if (trimmed === '*') {
			return '*'
		}

		try {
			return new URL(trimmed).origin
		} catch {
			return trimmed.replace(trailingSlashesPattern, '')
		}
	}

	function resolveCorsOrigin(raw: string): string | string[] {
		const parts = raw
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)

		if (parts.length === 0) {
			return ''
		}

		const normalizedOrigins = parts
			.map(normalizeCorsOriginValue)
			.filter((origin) => origin.length > 0)

		if (normalizedOrigins.length === 0) {
			return ''
		}

		const uniqueOrigins = Array.from(new Set(normalizedOrigins))
		if (uniqueOrigins.includes('*')) {
			return '*'
		}

		if (uniqueOrigins.length === 1) {
			const onlyOrigin = uniqueOrigins[0]
			if (!onlyOrigin) {
				return ''
			}
			return onlyOrigin
		}

		return uniqueOrigins
	}

	const corsOrigin = resolveCorsOrigin(
		env?.CORS_ORIGIN || process.env.CORS_ORIGIN || ''
	)

	console.log('corsOrigin', corsOrigin)
	console.log('env?.CORS_ORIGIN', env?.CORS_ORIGIN)
	console.log('process.env.CORS_ORIGIN', process.env.CORS_ORIGIN)

	app.use(logger())
	app.use(
		'/*',
		cors({
			origin: corsOrigin,
			allowMethods: ['GET', 'POST', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-Locale', 'Accept-Language'],
			credentials: true,
		}),
		timeout(30_000)
	)

	app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

	const apiHandler = new OpenAPIHandler(appRouter, {
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
		],
		interceptors: [
			onError((error) => {
				console.error(error)
			}),
		],
	})

	const rpcHandler = new RPCHandler(appRouter, {
		interceptors: [
			onError((error) => {
				console.error(error)
			}),
		],
	})

	app.use('/*', async (c, next) => {
		const context = await createContext({ context: c })

		c.header('Vary', 'Accept-Language, X-Locale')

		const rpcResult = await rpcHandler.handle(c.req.raw, {
			prefix: '/rpc',
			context,
		})

		if (rpcResult.matched) {
			return c.newResponse(rpcResult.response.body, rpcResult.response)
		}

		const apiResult = await apiHandler.handle(c.req.raw, {
			prefix: '/api-reference',
			context,
		})

		if (apiResult.matched) {
			return c.newResponse(apiResult.response.body, apiResult.response)
		}

		await next()
	})

	app.get('/', (c) => c.text('OK'))

	return app
}
