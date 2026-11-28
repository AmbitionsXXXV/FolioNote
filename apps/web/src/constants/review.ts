import {
  Clock01Icon,
  InboxIcon,
  RefreshIcon,
  StarIcon,
  ViewIcon
} from "@hugeicons-pro/core-stroke-rounded"
import type { IconSvgElement } from "@hugeicons/react"

import type { Rating, ReviewRule, SnoozePreset } from "@/types"
import type { RatingButtonConfig, SnoozePresetConfig } from "@/types/review"

/**
 * Review rule configurations for the dashboard
 */
export const REVIEW_RULES: {
  key: ReviewRule
  labelKey: string
  icon: IconSvgElement
  descriptionKey: string
}[] = [
  {
    key: "due",
    labelKey: "review.dueEntries",
    icon: Clock01Icon,
    descriptionKey: "review.dueEntriesDescription"
  },
  {
    key: "new",
    labelKey: "review.newEntries",
    icon: InboxIcon,
    descriptionKey: "review.newEntriesDescription"
  },
  {
    key: "starred",
    labelKey: "review.starredEntries",
    icon: StarIcon,
    descriptionKey: "review.starredEntriesDescription"
  },
  {
    key: "unreviewed",
    labelKey: "review.unreviewedEntries",
    icon: ViewIcon,
    descriptionKey: "review.unreviewedEntriesDescription"
  },
  {
    key: "all",
    labelKey: "review.allEntries",
    icon: RefreshIcon,
    descriptionKey: "review.allEntriesDescription"
  }
]

/**
 * Snooze preset options for review
 */
export const SNOOZE_PRESETS: SnoozePresetConfig[] = [
  { key: "tomorrow", labelKey: "review.snoozePreset.tomorrow" },
  { key: "3days", labelKey: "review.snoozePreset.3days" },
  { key: "7days", labelKey: "review.snoozePreset.7days" }
]

/**
 * Snooze preset labels for toast messages
 */
export const SNOOZE_PRESET_LABELS: Record<SnoozePreset, string> = {
  tomorrow: "review.snoozePreset.tomorrow",
  "3days": "review.snoozePreset.3days",
  "7days": "review.snoozePreset.7days",
  custom: "review.snoozePreset.custom"
}

/**
 * Rating button configurations
 */
export const RATING_BUTTONS: RatingButtonConfig[] = [
  {
    key: "again" as Rating,
    labelKey: "review.rating.again",
    hintKey: "review.rating.againHint",
    variant: "destructive"
  },
  {
    key: "hard" as Rating,
    labelKey: "review.rating.hard",
    hintKey: "review.rating.hardHint",
    variant: "outline",
    className:
      "border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950"
  },
  {
    key: "good" as Rating,
    labelKey: "review.rating.good",
    hintKey: "review.rating.goodHint",
    variant: "default"
  },
  {
    key: "easy" as Rating,
    labelKey: "review.rating.easy",
    hintKey: "review.rating.easyHint",
    variant: "outline",
    className:
      "border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950"
  }
]

/**
 * Get user's timezone offset in minutes
 */
export const getUserTimezoneOffset = (): number =>
  -new Date().getTimezoneOffset()
