import { Toaster } from "@folionote/ui/sonner"
import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts
} from "@tanstack/react-router"
import { RootProvider } from "fumadocs-ui/provider/tanstack"
import { ThemeProvider } from "next-themes"
import { lazy, Suspense, useState } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"

import { CommandPalette } from "@/components/command-palette"
import { RouterPendingIndicator } from "@/components/router-pending-indicator"
import { CommandPaletteProvider } from "@/contexts/command-palette-context"
import { getLanguage } from "@/functions/get-language"
import i18n from "@/lib/i18n"
import { siteConfig } from "@/lib/site-config"
import { cn } from "@/lib/utils"
import type { orpc } from "@/utils/orpc"

import appCss from "../index.css?url"

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Story+Script&family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&family=Outfit:wght@100..900&family=Spline+Sans:wght@300..700&family=Zen+Maru+Gothic&family=ZCOOL+QingKe+HuangYou&family=Leckerli+One&display=swap"

// Map language codes to CSS class names for font switching
function getLangClass(lang: string) {
  if (lang.startsWith("zh")) {
    return "lang-zh"
  }
  if (lang.startsWith("ja")) {
    return "lang-ja"
  }
  return "lang-en"
}

// Dev-only, client-only. In production this is `() => null` and the dynamic
// import is dead-code-eliminated, so the devtools packages (which call
// browser-only APIs at module load) never reach the SSR/production bundle.
const DevTools = import.meta.env.PROD
  ? () => null
  : lazy(() => import("@/components/dev-tools"))

export interface RouterAppContext {
  orpc: typeof orpc
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: () => ({ language: getLanguage() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      { title: siteConfig.name },
      { name: "description", content: siteConfig.description },
      { name: "theme-color", content: "#161210" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteConfig.name },
      { property: "og:title", content: siteConfig.name },
      { property: "og:description", content: siteConfig.description },
      { property: "og:image", content: siteConfig.ogImage },
      { property: "og:url", content: siteConfig.url },
      { property: "og:locale", content: siteConfig.locale },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: siteConfig.name },
      { name: "twitter:description", content: siteConfig.description },
      { name: "twitter:image", content: siteConfig.ogImage },
      { name: "twitter:site", content: siteConfig.twitter }
    ],
    links: [
      // Fonts load from <head> in parallel with the app CSS; an @import inside
      // that CSS was only discovered after the 1.1 MB stylesheet downloaded.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
      },
      { rel: "stylesheet", href: GOOGLE_FONTS_URL },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "icon", href: "/favicon.ico" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png"
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png"
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png"
      }
    ]
  }),

  component: RootDocument
})

function RootDocument() {
  const { language } = Route.useRouteContext()
  // The server renders many requests at once, so each gets its own instance
  // in that request's language; the browser keeps the shared one.
  const [instance] = useState(() =>
    import.meta.env.SSR ? i18n.cloneInstance({ lng: language }) : i18n
  )

  return (
    <I18nextProvider i18n={instance}>
      <AppDocument />
    </I18nextProvider>
  )
}

function AppDocument() {
  const { i18n: i18nInstance } = useTranslation()
  const currentLang = i18nInstance.language
  const langClass = getLangClass(currentLang)

  return (
    <html
      className={cn("no-scrollbar bg-background")}
      lang={currentLang}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body className={cn("min-h-svh bg-background", langClass)}>
        <RootProvider search={{ enabled: false }}>
          <ThemeProvider
            attribute={["class", "data-theme"]}
            defaultTheme="dark"
            disableTransitionOnChange
            enableSystem
          >
            <RouterPendingIndicator />
            <CommandPaletteProvider>
              <Outlet />
              <CommandPalette />
            </CommandPaletteProvider>
            <Toaster richColors />
          </ThemeProvider>
        </RootProvider>
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <DevTools />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  )
}
