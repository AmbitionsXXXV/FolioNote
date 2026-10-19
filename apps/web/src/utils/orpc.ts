import { createContext } from "@folionote/api/context"
import { appRouter } from "@folionote/api/routers/index"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import { createRouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryCache, QueryClient } from "@tanstack/react-query"
import { createIsomorphicFn } from "@tanstack/react-start"
import { toast } from "sonner"

import { getServerUrl } from "./api-environment"

/**
 * Store the last request ID for debugging purposes
 * Can be accessed via window.__lastRequestId in dev tools
 */
let lastRequestId: string | null = null

/**
 * Get the last request ID from the most recent API call
 */
export function getLastRequestId(): string | null {
  return lastRequestId
}

/**
 * Custom error class that includes request ID for tracing
 */
export class RPCErrorWithRequestId extends Error {
  requestId: string | null

  constructor(message: string, requestId: string | null) {
    super(message)
    this.name = "RPCErrorWithRequestId"
    this.requestId = requestId
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Extract request ID if available
      const requestId =
        error instanceof RPCErrorWithRequestId ? error.requestId : lastRequestId

      // Log to console in development for easier debugging
      if (import.meta.env.DEV) {
        console.error("[API Error]", {
          message: error.message,
          requestId,
          queryKey: query.queryKey
        })
      }

      // Queries that render their own inline error state opt out of the toast.
      if (query.meta?.silentError === true) {
        return
      }

      toast.error(`Error: ${error.message}`, {
        description: requestId ? `Request ID: ${requestId}` : undefined,
        action: {
          label: "retry",
          onClick: query.invalidate
        }
      })
    }
  })
})

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(appRouter, {
      context: async ({ req }) => createContext({ context: req })
    })
  )
  .client((): RouterClient<typeof appRouter> => {
    const link = new RPCLink({
      url: `${getServerUrl()}/rpc`,
      async fetch(rpcUrl, options) {
        const response = await globalThis.fetch(rpcUrl, {
          ...options,
          credentials: "include"
        })

        // Capture request ID from response header for tracing
        const requestId = response.headers.get("X-Request-Id")
        if (requestId) {
          lastRequestId = requestId

          // Expose to window for dev tools access
          if (import.meta.env.DEV && typeof window !== "undefined") {
            ;(window as Window & { __lastRequestId?: string }).__lastRequestId =
              requestId
          }
        }

        return response
      }
    })

    return createORPCClient(link)
  })

export const client: RouterClient<typeof appRouter> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
