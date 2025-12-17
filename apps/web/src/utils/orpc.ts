import { createContext } from '@ai-start/api/context'
import { appRouter } from '@ai-start/api/routers/index'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createRouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(`Error: ${error.message}`, {
				action: {
					label: 'retry',
					onClick: query.invalidate,
				},
			})
		},
	}),
})

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(appRouter, {
			context: async ({ req }) => createContext({ context: req }),
		})
	)
	.client((): RouterClient<typeof appRouter> => {
		const link = new RPCLink({
			url: `${import.meta.env.VITE_SERVER_URL}/rpc`,
			fetch(rpcUrl, options) {
				return globalThis.fetch(rpcUrl, {
					...options,
					credentials: 'include',
				})
			},
		})

		return createORPCClient(link)
	})

export const client: RouterClient<typeof appRouter> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
