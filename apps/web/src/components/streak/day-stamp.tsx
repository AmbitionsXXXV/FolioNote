import { cn } from "@/lib/utils"

import { stampTilt } from "./streak-utils"
import type { StudyDayStatus } from "./streak-utils"

interface DayStampProps {
  date: string
  status: StudyDayStatus
  isToday?: boolean
  isFuture?: boolean
  /** Mark inside an outlined stamp, e.g. 学 / 学 / 勉. */
  mark: string
  freezeMark: string
  className?: string
}

/**
 * One day's stamp: outlined for "studied", solid for "goal met", dashed
 * indigo for a freeze, dashed gray while today is still open.
 */
export function DayStamp({
  date,
  status,
  isToday = false,
  isFuture = false,
  mark,
  freezeMark,
  className
}: DayStampProps) {
  const base =
    "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-black"

  if (status === "frozen") {
    return (
      <span
        className={cn(
          base,
          "border-2 border-dashed border-freeze text-freeze",
          className
        )}
      >
        {freezeMark}
      </span>
    )
  }
  if (status === "goal_met") {
    return (
      <span
        className={cn(
          base,
          "bg-stamp text-stamp-foreground",
          stampTilt(date),
          className
        )}
      >
        {mark}
      </span>
    )
  }
  if (status === "active") {
    return (
      <span
        className={cn(
          base,
          "border-[2.5px] border-stamp text-stamp",
          stampTilt(date),
          className
        )}
      >
        {mark}
      </span>
    )
  }
  if (isToday) {
    return (
      <span
        className={cn(
          base,
          "border-2 border-dashed border-muted/50 bg-surface-secondary/50 text-muted",
          className
        )}
      >
        +
      </span>
    )
  }
  return (
    <span
      className={cn(
        base,
        isFuture ? "bg-surface-secondary/60" : "bg-surface-tertiary/70",
        className
      )}
    />
  )
}
