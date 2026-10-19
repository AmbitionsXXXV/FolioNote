import {
  AccountSetting01Icon,
  AiBeautifyIcon,
  PlugSocketIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

const SETTINGS_NAV_ITEMS = [
  {
    labelKey: "settings.nav.general",
    icon: AccountSetting01Icon,
    to: "/settings/general"
  },
  {
    labelKey: "settings.nav.models",
    icon: AiBeautifyIcon,
    to: "/settings/models"
  },
  {
    labelKey: "settings.nav.connections",
    icon: PlugSocketIcon,
    to: "/settings/connections"
  }
] as const

/**
 * Settings sections, shown inside the page next to the content (a column on
 * desktop, a scrolling row on phones) so the app sidebar stays the only one.
 */
export function SettingsNav() {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()

  return (
    <nav
      aria-label={t("settings.title")}
      className="md:sticky md:top-12 md:w-48 md:shrink-0 md:self-start"
    >
      <p className="mb-3 px-3 font-display text-lg font-semibold">
        {t("settings.title")}
      </p>
      <ul className="no-scrollbar flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const isActive = Boolean(matchRoute({ to: item.to, fuzzy: true }))
          return (
            <li className="shrink-0" key={item.to}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
                  isActive
                    ? "bg-surface-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface-secondary/50 hover:text-foreground"
                )}
                to={item.to}
              >
                <HugeiconsIcon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  icon={item.icon}
                />
                {t(item.labelKey)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
