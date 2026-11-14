import { Button } from "@folionote/ui/button"
import { CheckmarkCircle02Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

import { Surface } from "@/components/surface"
import type { ReviewEmptyStateProps } from "@/types/review"

/**
 * ReviewEmptyState - Empty state component when review queue is empty
 */
export function ReviewEmptyState({
  selectedRule,
  ruleLabel,
  onStop
}: ReviewEmptyStateProps) {
  const { t } = useTranslation()
  const message =
    selectedRule === "all" || selectedRule === "due"
      ? t("review.allCompleted")
      : t("review.noMatchingEntries", { rule: ruleLabel })

  return (
    <Surface className="mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/5 ring-1 ring-primary/15">
        <HugeiconsIcon
          className="size-8 text-green-500"
          icon={CheckmarkCircle02Icon}
        />
      </div>
      <p className="mb-2 font-display text-xl font-semibold tracking-tight">
        {t("review.greatJob")}
      </p>
      <p className="mb-6 text-muted-foreground">{message}</p>
      <Button
        aria-label={t("review.backLabel")}
        className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
        onClick={onStop}
        variant="outline"
      >
        {t("common.back")}
      </Button>
    </Surface>
  )
}
