import { useThemeColor } from "heroui-native"
import type { ReactNode } from "react"
import { RefreshControl, ScrollView } from "react-native"

import { QuickStatsCard } from "./quick-stats-card"
import { TodayHeader } from "./today-header"
import { TodayReviewCard } from "./today-review-card"

interface TodayContentProps {
  userName: string
  streak: number
  dueToday: number
  overdue: number
  reviewedToday: number
  newCount: number
  totalEntries: number
  starredEntries: number
  unreviewedEntries: number
  isRefetching: boolean
  onRefresh: () => void
  onStartReview: () => void
  /** Rendered under the greeting (check-in card, local-mode banner). */
  header?: ReactNode
  /** Rendered after the stats (recent entries). */
  footer?: ReactNode
}

export function TodayContent({
  userName,
  streak,
  dueToday,
  overdue,
  reviewedToday,
  newCount,
  totalEntries,
  starredEntries,
  unreviewedEntries,
  isRefetching,
  onRefresh,
  onStartReview,
  header,
  footer
}: TodayContentProps) {
  const accentColor = useThemeColor("accent")

  const totalDue = overdue + dueToday
  const hasItemsToReview = totalDue > 0 || newCount > 0

  return (
    <ScrollView
      // iOS: 自动调整内容偏移以适应透明 header (Liquid Glass)
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          onRefresh={onRefresh}
          refreshing={isRefetching}
          tintColor={accentColor}
        />
      }
    >
      <TodayHeader streak={streak} userName={userName} />

      {header}

      <TodayReviewCard
        dueToday={dueToday}
        hasItemsToReview={hasItemsToReview}
        newCount={newCount}
        onStartReview={onStartReview}
        overdue={overdue}
        reviewedToday={reviewedToday}
        totalDue={totalDue}
      />

      <QuickStatsCard
        starredEntries={starredEntries}
        totalEntries={totalEntries}
        unreviewedEntries={unreviewedEntries}
      />

      {footer}
    </ScrollView>
  )
}
