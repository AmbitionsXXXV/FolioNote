import { getTzOffset } from "@folionote/utils"
import {
  Album01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  RefreshIcon,
  SparklesIcon,
  StarIcon,
  Tick02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import type { IconSvgElement } from "@hugeicons/react-native"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, cn, useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native"

import { Container } from "@/components/container"
import {
  GroupedCard,
  GroupedRow,
  GroupedSection,
  RowSeparator
} from "@/components/grouped-list"
import { ReviewCard } from "@/components/review-card"
import { ReviewRatingButtons } from "@/components/review-rating-buttons"
import { useDataServiceContext } from "@/contexts/data-service-context"
import { useHideTabBar } from "@/contexts/tab-bar-context"
import { orpc } from "@/utils/orpc"

type ReviewRule = "due" | "new" | "starred" | "unreviewed" | "all"
type Rating = "again" | "hard" | "good" | "easy"

function ReviewSessionView({
  entries,
  currentIndex,
  onEndReview,
  onRating,
  isPending
}: {
  entries: {
    id: string
    title: string | null
    contentText: string | null
    contentJson: string | null
    isStarred: boolean | null
    isPinned: boolean | null
    createdAt: Date
    updatedAt: Date
  }[]
  currentIndex: number
  onEndReview: () => void
  onRating: (rating: Rating) => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  const mutedColor = useThemeColor("muted")
  const currentEntry = entries[currentIndex]

  if (!currentEntry) {
    return null
  }

  return (
    <Container className="flex-1">
      <View className="flex-1 p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Button
            className="flex-row items-center active:opacity-70"
            onPress={onEndReview}
          >
            <HugeiconsIcon color={mutedColor} icon={Cancel01Icon} size={24} />
            <Text className="ml-2 text-muted">{t("review.endReview")}</Text>
          </Button>
          <Text className="text-muted">
            {currentIndex + 1} / {entries.length}
          </Text>
        </View>

        <View className="flex-1">
          <ReviewCard entry={currentEntry} />
        </View>

        <ReviewRatingButtons isPending={isPending} onRating={onRating} />
      </View>
    </Container>
  )
}

function ReviewCompletedView({
  reviewedCount,
  onDone
}: {
  reviewedCount: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const successColor = useThemeColor("success")

  return (
    <Container className="flex-1 items-center justify-center p-6" disableScroll>
      <HugeiconsIcon
        color={successColor}
        icon={CheckmarkCircle02Icon}
        size={80}
      />
      <Text className="mt-4 text-center text-2xl font-semibold text-foreground">
        {t("review.greatJob")}
      </Text>
      <Text className="mt-2 text-center text-muted">
        {t("review.completedSession")}
      </Text>
      <Text className="mt-4 text-center text-muted">
        {t("review.reviewedTodayCount", { count: reviewedCount })}
      </Text>
      <Button className="mt-8 px-8" onPress={onDone} size="lg">
        <Button.Label>{t("common.done")}</Button.Label>
      </Button>
    </Container>
  )
}

interface ScopeOption {
  rule: ReviewRule
  icon: IconSvgElement
  iconTone?: "accent" | "neutral"
  title: string
  description: string
  count: number | undefined
}

function StatCell({
  label,
  value,
  valueClassName
}: {
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <View className="flex-1 items-center gap-0.5 py-3.5">
      <Text
        className={cn(
          "text-[22px] font-bold text-foreground tabular-nums",
          valueClassName
        )}
      >
        {value}
      </Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  )
}

export default function ReviewScreen() {
  const { t } = useTranslation()
  const { dataService, isMigrating } = useDataServiceContext()
  const queryClient = useQueryClient()
  const [currentRule, setCurrentRule] = useState<ReviewRule>("due")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isReviewing, setIsReviewing] = useState(false)
  // A session is immersive: the tab bar would cover the rating bar.
  useHideTabBar(isReviewing)

  const accentColor = useThemeColor("accent")

  const {
    data: queueData,
    isLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ["review", "queue", currentRule],
    queryFn: async () => {
      if (!dataService) {
        return { items: [], reviewedTodayCount: 0 }
      }
      const items = await dataService.review.getQueue({
        mode: currentRule,
        limit: 50,
        tzOffset: getTzOffset()
      })
      const todayStats = await dataService.review.getTodayStats(getTzOffset())
      return { items, reviewedTodayCount: todayStats.reviewedToday }
    },
    enabled: !!dataService
  })

  // Same keys as the Today tab, so both read one cache.
  const { data: dueStats } = useQuery({
    queryKey: ["review", "dueStats"],
    queryFn: () => dataService?.review.getDueStats(getTzOffset()),
    enabled: !!dataService
  })

  const { data: todayStats } = useQuery({
    queryKey: ["review", "todayStats"],
    queryFn: () => dataService?.review.getTodayStats(getTzOffset()),
    enabled: !!dataService
  })

  const markReviewedMutation = useMutation({
    mutationFn: ({ entryId, rating }: { entryId: string; rating: Rating }) => {
      if (!dataService) {
        throw new Error("DataService not available")
      }
      return dataService.review.markReviewed(entryId, rating)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review"] })
      queryClient.invalidateQueries({ queryKey: orpc.streak.key() })
      setCurrentIndex((prev) => prev + 1)
    }
  })

  const handleStartReview = () => {
    setIsReviewing(true)
    setCurrentIndex(0)
  }

  const handleEndReview = () => {
    setIsReviewing(false)
    setCurrentIndex(0)
    refetch()
  }

  const handleRating = (rating: Rating) => {
    const currentEntry = queueData?.items[currentIndex]
    if (currentEntry) {
      markReviewedMutation.mutate({ entryId: currentEntry.id, rating })
    }
  }

  const handleRuleChange = (rule: ReviewRule) => {
    setCurrentRule(rule)
    setCurrentIndex(0)
    setIsReviewing(false)
  }

  // Show loading while migrating or loading data
  if (isMigrating || isLoading || !dataService) {
    return (
      <Container className="flex-1 items-center justify-center">
        <ActivityIndicator color={accentColor} size="large" />
      </Container>
    )
  }

  const entries = queueData?.items ?? []
  const hasMoreEntries = currentIndex < entries.length
  const reviewedTodayCount = queueData?.reviewedTodayCount ?? 0

  if (isReviewing && hasMoreEntries) {
    return (
      <ReviewSessionView
        currentIndex={currentIndex}
        entries={entries}
        isPending={markReviewedMutation.isPending}
        onEndReview={handleEndReview}
        onRating={handleRating}
      />
    )
  }

  if (isReviewing && !hasMoreEntries) {
    return (
      <ReviewCompletedView
        onDone={handleEndReview}
        reviewedCount={reviewedTodayCount + currentIndex}
      />
    )
  }

  const totalDue = (dueStats?.overdue ?? 0) + (dueStats?.dueToday ?? 0)
  const goalTotal = reviewedTodayCount + totalDue
  const progress = goalTotal > 0 ? reviewedTodayCount / goalTotal : 0
  const scopeOptions: ScopeOption[] = [
    {
      rule: "due",
      icon: RefreshIcon,
      title: t("review.dueEntries"),
      description: t("review.dueEntriesDescription"),
      count: totalDue
    },
    {
      rule: "new",
      icon: SparklesIcon,
      title: t("review.newEntries"),
      description: t("review.newEntriesDescription"),
      count: dueStats?.newCount
    },
    {
      rule: "starred",
      icon: StarIcon,
      title: t("review.starredEntries"),
      description: t("review.starredEntriesDescription"),
      count: todayStats?.starredEntries
    },
    {
      rule: "all",
      icon: Album01Icon,
      iconTone: "neutral",
      title: t("review.allEntries"),
      description: t("review.allEntriesDescription"),
      count: todayStats?.totalEntries
    }
  ]

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              refetch()
              queryClient.invalidateQueries({ queryKey: ["review"] })
            }}
            refreshing={isRefetching}
            tintColor={accentColor}
          />
        }
      >
        <Text className="px-1 text-[13px] text-muted">
          {t("review.description")}
        </Text>

        <GroupedCard className="p-4">
          <View className="flex-row items-end justify-between gap-3">
            <View>
              <Text className="text-[13px] text-muted">
                {t("review.dueToday")}
              </Text>
              <Text className="text-[44px] leading-[48px] font-bold text-foreground tabular-nums">
                {totalDue}
                <Text className="text-[17px] font-medium text-muted">
                  {` ${t("review.itemsUnit", { count: totalDue })}`}
                </Text>
              </Text>
            </View>
            {(dueStats?.overdue ?? 0) > 0 && (
              <Text className="pb-1.5 text-[13px] text-danger">
                {t("review.overdueCount", { count: dueStats?.overdue ?? 0 })}
              </Text>
            )}
          </View>

          <View
            accessibilityLabel={t("review.reviewedToday", {
              count: reviewedTodayCount
            })}
            accessibilityRole="progressbar"
            accessibilityValue={{
              now: Math.round(progress * 100),
              min: 0,
              max: 100
            }}
            className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-default"
          >
            <View
              className="h-1.5 rounded-full bg-accent"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
          <Text className="mt-1.5 text-[13px] text-muted">
            {t("review.reviewedToday", { count: reviewedTodayCount })}
          </Text>

          <Button
            className="mt-4"
            isDisabled={entries.length === 0}
            onPress={handleStartReview}
            size="lg"
          >
            <Button.Label>
              {entries.length > 0
                ? t("review.startCount", { count: entries.length })
                : t("review.noReviewItems")}
            </Button.Label>
          </Button>
        </GroupedCard>

        <GroupedSection title={t("review.scopeTitle")}>
          <GroupedCard>
            {scopeOptions.map((option, index) => {
              const isSelected = currentRule === option.rule
              return (
                <View key={option.rule}>
                  {index > 0 && <RowSeparator />}
                  <GroupedRow
                    accessibilityState={{ selected: isSelected }}
                    accessory={
                      <View className="w-5 items-center">
                        {isSelected && (
                          <HugeiconsIcon
                            color={accentColor}
                            icon={Tick02Icon}
                            size={18}
                          />
                        )}
                      </View>
                    }
                    icon={option.icon}
                    iconTone={option.iconTone}
                    label={option.title}
                    onPress={() => handleRuleChange(option.rule)}
                    sublabel={option.description}
                    value={option.count}
                  />
                </View>
              )
            })}
          </GroupedCard>
        </GroupedSection>

        <GroupedSection title={t("review.statsTitle")}>
          <GroupedCard className="flex-row">
            <StatCell
              label={t("review.statsStreak")}
              value={t("streak.days", { count: todayStats?.streak ?? 0 })}
              valueClassName="text-danger"
            />
            <StatCell
              label={t("review.statsTotalEntries")}
              value={todayStats?.totalEntries ?? 0}
            />
            <StatCell
              label={t("review.statsUnreviewedEntries")}
              value={todayStats?.unreviewedEntries ?? 0}
            />
          </GroupedCard>
        </GroupedSection>
      </ScrollView>
    </Container>
  )
}
