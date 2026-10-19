import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

export interface LevelSpreadCounts {
  N5: number
  N4: number
  N3: number
  N2: number
  N1: number
  unlisted: number
}

type LevelKey = keyof LevelSpreadCounts

const LEVEL_ORDER: LevelKey[] = ["N5", "N4", "N3", "N2", "N1", "unlisted"]

/** Easy → hard runs warm-to-deep; "not listed" stays neutral so it reads as unknown, not hard. */
const LEVEL_SWATCH: Record<LevelKey, string> = {
  N5: "bg-emerald-400",
  N4: "bg-teal-400",
  N3: "bg-amber-400",
  N2: "bg-orange-400",
  N1: "bg-rose-400",
  unlisted: "bg-muted-foreground/30"
}

/**
 * Stacked bar of word counts per community JLPT level. The whole chart also
 * exists as one sentence for screen readers, since the colours carry it.
 */
export function JapaneseLevelSpread({ levels }: { levels: LevelSpreadCounts }) {
  const { t } = useTranslation()
  const total = LEVEL_ORDER.reduce((sum, level) => sum + levels[level], 0)
  const labelFor = (level: LevelKey) =>
    level === "unlisted" ? t("japanese.import.article.levelUnlisted") : level
  const summary = LEVEL_ORDER.map((level) =>
    t("japanese.import.article.levelsSummary", {
      level: labelFor(level),
      count: levels[level]
    })
  ).join(", ")

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("japanese.import.article.levelsTitle")}
        </h3>
        <span className="text-[11px] text-muted-foreground/80">
          {t("japanese.import.article.levelsApprox")}
        </span>
      </div>
      <div
        aria-label={summary}
        className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-secondary"
        role="img"
      >
        {total > 0
          ? LEVEL_ORDER.filter((level) => levels[level] > 0).map((level) => (
              <span
                className={cn("h-full", LEVEL_SWATCH[level])}
                key={level}
                style={{ width: `${(levels[level] / total) * 100}%` }}
              />
            ))
          : null}
      </div>
      <ul
        aria-hidden="true"
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
      >
        {LEVEL_ORDER.map((level) => (
          <li className="flex items-center gap-1" key={level}>
            <span
              className={cn(
                "inline-block size-2 rounded-sm",
                LEVEL_SWATCH[level]
              )}
            />
            <span>
              {labelFor(level)}{" "}
              <span className="font-medium text-foreground">
                {levels[level]}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{summary}</p>
    </div>
  )
}
