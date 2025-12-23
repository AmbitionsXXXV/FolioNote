import 'dotenv/config'
import { createContext } from '@folionote/api/context'
import { appRouter } from '@folionote/api/routers/index'
import { auth } from '@folionote/auth'
import { serve } from '@hono/node-server'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timeout } from 'hono/timeout'
import { initI18n } from './i18n'

await initI18n()

const app = new Hono()

app.use(logger())
app.use(
	'/*',
	cors({
		origin: process.env.CORS_ORIGIN || '',
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-Locale', 'Accept-Language'],
		credentials: true,
	}),
	timeout(30_000)
)

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

export const apiHandler = new OpenAPIHandler(appRouter, {
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

export const rpcHandler = new RPCHandler(appRouter, {
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

const port = Number(process.env.PORT) || 3000

console.log(`Server is running on http://localhost:${port}`)

serve({
	fetch: app.fetch,
	port,
})

export default app
