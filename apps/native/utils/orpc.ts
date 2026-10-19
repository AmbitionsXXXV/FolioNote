import type { AppRouterClient } from "@folionote/api/routers/index"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryCache, QueryClient } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.log(error)
    }
  })
})

export const link = new RPCLink({
  url: `${process.env.EXPO_PUBLIC_SERVER_URL}/rpc`,
  async headers() {
    const headers = new Map<string, string>()
    const cookies = await authClient.getCookie()
    if (cookies) {
      headers.set("Cookie", cookies)
    }
    return Object.fromEntries(headers)
  }
})

export const client: AppRouterClient = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
