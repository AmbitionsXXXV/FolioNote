import { Button } from "@folionote/ui/button"
import { Skeleton } from "@folionote/ui/skeleton"
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  Fire02Icon,
  InboxIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { useTranslation } from "react-i18next"

import type { StatsContentProps } from "@/types/review"

import { StatsCard } from "./stats-card"

/**
 * StatsContent - Review statistics content component
 */
export function StatsContent({
  isLoading,
  isError,
  errorMessage,
  onRetry,
  stats,
  dueStats
}: StatsContentProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </>
    )
  }

  if (isError) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
        <p className="mb-2 text-sm text-destructive">
          {errorMessage ?? t("review.statsLoadFailed")}
        </p>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("common.retry")}
        </Button>
      </div>
    )
  }

  // Calculate total due (overdue + dueToday)
  const totalDue = (dueStats?.overdue ?? 0) + (dueStats?.dueToday ?? 0)

  return (
    <>
      <StatsCard
        description="review.statsDueEntries"
        icon={Clock01Icon}
        iconColor="text-orange-500"
        value={totalDue}
      />
      <StatsCard
        description="review.statsReviewedToday"
        icon={CheckmarkCircle02Icon}
        iconColor="text-green-500"
        value={stats?.reviewedToday ?? 0}
      />
      <StatsCard
        description="review.statsNewEntries"
        icon={InboxIcon}
        iconColor="text-blue-500"
        value={dueStats?.newCount ?? 0}
      />
      <StatsCard
        description="review.statsStreak"
        icon={Fire02Icon}
        iconColor="text-red-500"
        value={stats?.streak ?? 0}
      />
    </>
  )
}
