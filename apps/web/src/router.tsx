import { QueryClientProvider } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"

import { DefaultErrorBoundary } from "./components/error-boundary"
import { NotFound } from "./components/not-found"
import { RoutePageSkeleton } from "./components/route-page-skeleton"
import { routeTree } from "./routeTree.gen"
import { orpc, queryClient } from "./utils/orpc"

// A deploy or dev-server restart changes the hashed URLs of lazy route chunks,
// so a tab opened before the restart fails its next dynamic import with
// "Failed to fetch dynamically imported module". Vite emits `vite:preloadError`
// for exactly this; reload once to pick up the new chunk URLs. The timestamp
// guard breaks the loop when a chunk is genuinely unreachable, letting the
// error surface to the route error boundary instead of reloading forever.
if (typeof window !== "undefined") {
  const LAST_RELOAD_KEY = "vite:preloadError:lastReload"
  const RELOAD_COOLDOWN_MS = 10_000
  window.addEventListener("vite:preloadError", () => {
    const now = Date.now()
    const lastReload = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0)
    if (now - lastReload > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(LAST_RELOAD_KEY, String(now))
      window.location.reload()
    }
  })
}

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30_000,
    defaultPendingMinMs: 200,
    defaultPendingMs: 0,
    defaultPendingComponent: RoutePageSkeleton,
    context: { orpc, queryClient },
    defaultNotFoundComponent: () => <NotFound />,
    defaultErrorComponent: DefaultErrorBoundary,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
