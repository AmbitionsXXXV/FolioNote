import { Link, useMatchRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

const SECTIONS = [
  { to: "/japanese", labelKey: "japanese.sections.search", fuzzy: false },
  { to: "/japanese/read", labelKey: "japanese.sections.reading", fuzzy: true },
  { to: "/japanese/library", labelKey: "japanese.library.title", fuzzy: true },
  {
    to: "/japanese/practice/exam",
    labelKey: "japanese.sections.practice",
    fuzzy: true
  }
] as const

/** Pill links between the hub's real destinations: Search · Reading · Library · Practice. */
export function JapaneseSectionNav() {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()
  const isPractice = Boolean(
    matchRoute({ to: "/japanese/practice/typing", fuzzy: true })
  )
  const isWordPage = Boolean(matchRoute({ to: "/japanese/word/$id" }))
  // Importing and browsing a word list both belong to the library.
  const isLibrary =
    Boolean(matchRoute({ to: "/japanese/import" })) ||
    Boolean(matchRoute({ to: "/japanese/lists/$lexiconId", fuzzy: true }))

  return (
    <nav
      aria-label={t("japanese.title")}
      className="flex flex-wrap items-center justify-center gap-1.5"
    >
      {SECTIONS.map(({ to, labelKey, fuzzy }) => {
        const isCurrent =
          Boolean(matchRoute({ to, fuzzy })) ||
          (to === "/japanese" && isWordPage) ||
          (to === "/japanese/library" && isLibrary) ||
          (labelKey === "japanese.sections.practice" && isPractice)
        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
              isCurrent
                ? "bg-primary/12 text-foreground ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
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
