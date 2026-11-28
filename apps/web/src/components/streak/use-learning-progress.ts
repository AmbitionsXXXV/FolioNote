import type { LearningProgress } from "@folionote/api/utils/learning-activity"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { orpc } from "@/utils/orpc"

/**
 * React to the `progress` a study mutation returns: refresh the check-in
 * views and celebrate the day's stamp, the goal and milestones once each.
 */
export function useLearningProgress() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useCallback(
    (progress: LearningProgress | null | undefined) => {
      queryClient.invalidateQueries({ queryKey: orpc.streak.key() })
      if (!progress) return

      if (progress.newMilestone !== null) {
        toast.success(
          t("streak.toast.milestone", { count: progress.newMilestone })
        )
      } else if (progress.justCheckedIn) {
        toast.success(
          t("streak.toast.checkedIn", { count: progress.currentDays })
        )
      }
      if (progress.justMetGoal) {
        toast.success(
          t("streak.toast.goalMet", { points: progress.todayPoints })
        )
      }
      if (progress.earnedFreeze) {
        toast(t("streak.toast.freezeEarned"))
      }
    },
    [queryClient, t]
  )
}
