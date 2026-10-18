import { Link, useMatchRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

/**
 * Practice views fill the space under the Japanese hub frame (top padding +
 * section pills ≈ 5rem, plus the 3.5rem mobile header below md) so their
 * sticky bottom bar starts on screen instead of below the fold.
 */
export const PRACTICE_VIEW_MIN_HEIGHT =
  "min-h-[calc(100svh-8.5rem)] md:min-h-[calc(100svh-5.5rem)]"

const TABS = [
  { to: "/japanese/practice/exam", labelKey: "japanese.practice.exam" },
  { to: "/japanese/practice/vocab", labelKey: "japanese.practice.vocab" }
] as const

/** Switches between the practice modes: mock exam questions and vocabulary. */
export function JapanesePracticeTabs() {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()

  return (
    <nav
      aria-label={t("japanese.sections.practice")}
      className="flex gap-0.5 rounded-xl border border-border/50 bg-surface-secondary/40 p-0.5"
    >
      {TABS.map(({ to, labelKey }) => {
        const isCurrent = Boolean(matchRoute({ to }))
        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "rounded-[0.6rem] px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
              isCurrent
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={to}
            to={to}
          >
            {t(labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
