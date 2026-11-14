import { PlayIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { Button, Card, cn } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Text } from "react-native"

import { TodayStatsGrid } from "./today-stats-grid"

interface TodayReviewCardProps {
  dueToday: number
  overdue: number
  reviewedToday: number
  newCount: number
  hasItemsToReview: boolean
  totalDue: number
  onStartReview: () => void
}

export function TodayReviewCard({
  dueToday,
  overdue,
  reviewedToday,
  newCount,
  hasItemsToReview,
  totalDue,
  onStartReview
}: TodayReviewCardProps) {
  const { t } = useTranslation()

  const buttonText = hasItemsToReview
    ? t("review.dueCount", { count: totalDue || newCount })
    : t("review.allCompleted")

  return (
    <Card className="mb-4 p-4" variant="secondary">
      <Text className="mb-4 text-lg font-semibold text-foreground">
        {t("review.today")}
      </Text>

      <TodayStatsGrid
        dueToday={dueToday}
        newCount={newCount}
        overdue={overdue}
        reviewedToday={reviewedToday}
      />

      <Button
        className={cn(
          "flex-row items-center justify-center bg-accent active:opacity-70",
          !hasItemsToReview && "opacity-50"
        )}
        isDisabled={!hasItemsToReview}
        onPress={onStartReview}
      >
        <HugeiconsIcon color="white" icon={PlayIcon} size={20} />
        <Text className="ml-2 font-semibold text-white">{buttonText}</Text>
      </Button>
    </Card>
  )
}
