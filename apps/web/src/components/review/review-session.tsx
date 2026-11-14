import { Button } from "@folionote/ui/button"
import { Skeleton } from "@folionote/ui/skeleton"
import { RefreshIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Reveal } from "@/components/reveal"
import { Surface } from "@/components/surface"
import {
  getUserTimezoneOffset,
  REVIEW_RULES,
  SNOOZE_PRESET_LABELS
} from "@/constants"
import type { Entry, Rating, SnoozePreset } from "@/types"
import type { ReviewSessionProps } from "@/types/review"
import { orpc } from "@/utils/orpc"

import { ReviewCard } from "./review-card"
import { ReviewEmptyState } from "./review-empty-state"
import { ReviewProgressBar } from "./review-progress-bar"
import { ReviewSessionHeader } from "./review-session-header"

const RATING_HOTKEYS = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy"
} as const satisfies Record<string, Rating>

/**
 * ReviewSession - Main review session component
 */
export function ReviewSession({
  selectedRule,
  currentIndex,
  onIndexChange,
  onStop
}: ReviewSessionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tzOffset = getUserTimezoneOffset()

  const {
    data: queueData,
    isLoading: isLoadingQueue,
    isError: isQueueError,
    error: queueError,
    refetch: refetchQueue
  } = useQuery({
    queryKey: ["review", "queue", selectedRule, tzOffset],
    queryFn: () =>
      orpc.review.getQueue.call({
        rule: selectedRule,
        limit: 50,
        tzOffset
      })
  })

  const markReviewedMutation = useMutation({
    mutationFn: ({ entryId, rating }: { entryId: string; rating: Rating }) =>
      orpc.review.markReviewed.call({ entryId, rating }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["review", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["review", "dueStats"] })

      // Show next review info
      if (data.state) {
        const days = data.state.intervalDays
        if (days === 1) {
          toast.success(t("review.nextReviewTomorrow"))
        } else {
          toast.success(t("review.nextReview", { days }))
        }
      }

      const queueItems = queueData?.items ?? []
      if (queueItems.length > 0 && currentIndex < queueItems.length - 1) {
        onIndexChange((prev) => prev + 1)
      } else {
        toast.success(t("review.completedSession"))
        onStop()
        refetchQueue()
      }
    },
    onError: () => {
      toast.error(t("review.markFailed"))
    }
  })

  const snoozeMutation = useMutation({
    mutationFn: ({
      entryId,
      preset
    }: {
      entryId: string
      preset: SnoozePreset
    }) => orpc.review.snooze.call({ entryId, preset, tzOffset }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["review", "queue"] })
      queryClient.invalidateQueries({ queryKey: ["review", "dueStats"] })

      // Show snooze confirmation
      const presetLabelKey = SNOOZE_PRESET_LABELS[data.preset]
      toast.success(t("review.snoozed", { preset: t(presetLabelKey) }))

      // Move to next entry
      const queueItems = queueData?.items ?? []
      if (queueItems.length > 0 && currentIndex < queueItems.length - 1) {
        onIndexChange((prev) => prev + 1)
      } else {
        toast.info(t("review.queueEnd"))
        onStop()
        refetchQueue()
      }
    },
    onError: () => {
      toast.error(t("review.snoozeFailed"))
    }
  })

  const handleRate = useCallback(
    (rating: Rating) => {
      const currentEntry = queueData?.items[currentIndex]
      if (currentEntry) {
        markReviewedMutation.mutate({ entryId: currentEntry.id, rating })
      }
    },
    [queueData?.items, currentIndex, markReviewedMutation]
  )

  const handleSkip = useCallback(() => {
    const queueItems = queueData?.items ?? []
    if (queueItems.length > 0 && currentIndex < queueItems.length - 1) {
      onIndexChange((prev) => prev + 1)
    } else {
      toast.info(t("review.queueEnd"))
    }
  }, [queueData?.items, currentIndex, onIndexChange, t])

  const handleSnooze = useCallback(
    (preset: SnoozePreset) => {
      const currentEntry = queueData?.items[currentIndex]
      if (currentEntry) {
        snoozeMutation.mutate({ entryId: currentEntry.id, preset })
      }
    },
    [queueData?.items, currentIndex, snoozeMutation]
  )

  const isMutating = markReviewedMutation.isPending || snoozeMutation.isPending

  useHotkey("1", (event) => {
    if (isMutating) {
      return
    }
    event.preventDefault()
    handleRate(RATING_HOTKEYS["1"])
  })

  useHotkey("2", (event) => {
    if (isMutating) {
      return
    }
    event.preventDefault()
    handleRate(RATING_HOTKEYS["2"])
  })

  useHotkey("3", (event) => {
    if (isMutating) {
      return
    }
    event.preventDefault()
    handleRate(RATING_HOTKEYS["3"])
  })

  useHotkey("4", (event) => {
    if (isMutating) {
      return
    }
    event.preventDefault()
    handleRate(RATING_HOTKEYS["4"])
  })

  useHotkey("Enter", (event) => {
    if (isMutating) {
      return
    }
    event.preventDefault()
    handleSkip()
  })

  const items = queueData?.items ?? []
  const currentEntry = items[currentIndex] as Entry | undefined
  const totalInQueue = items.length
  const reviewedToday = queueData?.reviewedTodayCount ?? 0
  const ruleRule = REVIEW_RULES.find((r) => r.key === selectedRule)
  const ruleLabel = ruleRule ? t(ruleRule.labelKey) : ""

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <ReviewSessionHeader
        currentIndex={currentIndex}
        onStop={onStop}
        reviewedToday={reviewedToday}
        ruleLabel={ruleLabel}
        totalInQueue={totalInQueue}
      />

      <ReviewProgressBar
        currentIndex={currentIndex}
        totalInQueue={totalInQueue}
      />

      {isLoadingQueue ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {isQueueError ? (
        <Surface className="flex flex-col items-center justify-center p-6 py-16 text-center">
          <HugeiconsIcon
            className="mb-4 size-12 text-destructive/50"
            icon={RefreshIcon}
          />
          <p className="mb-2 font-display font-semibold text-destructive">
            {t("review.loadFailed")}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            {queueError?.message ?? t("error.unknown")}
          </p>
          <Button onClick={() => refetchQueue()} variant="outline">
            {t("common.retry")}
          </Button>
        </Surface>
      ) : null}

      {!(isLoadingQueue || isQueueError) && totalInQueue === 0 ? (
        <ReviewEmptyState
          onStop={onStop}
          ruleLabel={ruleLabel}
          selectedRule={selectedRule}
        />
      ) : null}

      {!(isLoadingQueue || isQueueError) && currentEntry ? (
        <Reveal>
          <ReviewCard
            entry={currentEntry}
            isLoading={isMutating}
            onRate={handleRate}
            onSkip={handleSkip}
            onSnooze={handleSnooze}
          />
        </Reveal>
      ) : null}
    </div>
  )
}
