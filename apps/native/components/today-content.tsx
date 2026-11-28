import { formatDate } from "@folionote/locales"
import {
  CheckmarkCircle02Icon,
  RefreshIcon,
  SparklesIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { useThemeColor } from "heroui-native"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { RefreshControl, ScrollView, Text } from "react-native"

import {
  GroupedCard,
  GroupedRow,
  GroupedSection,
  RowSeparator
} from "./grouped-list"

interface TodayContentProps {
  /** Offline / local-mode fallback; the check-in card shows it when signed in. */
  streak: number
  totalDue: number
  newCount: number
  isRefetching: boolean
  onRefresh: () => void
  onStartReview: () => void
  /** The check-in card (hero) and the local-mode banner. */
  header?: ReactNode
  /** Recent entries. */
  footer?: ReactNode
}

/**
 * Today: date eyebrow under the large title, the check-in card as the hero,
 * a "to do today" list that links into each task, then recent entries.
 */
export function TodayContent({
  streak,
  totalDue,
  newCount,
  isRefetching,
  onRefresh,
  onStartReview,
  header,
  footer
}: TodayContentProps) {
  const { t, i18n } = useTranslation()
  const accentColor = useThemeColor("accent")

  const dateString = formatDate(new Date(), {
    locale: i18n.language,
    preset: "full"
  })
  const eyebrow =
    streak > 0
      ? `${dateString} · ${t("review.streakDays", { count: streak })}`
      : dateString
  const isAllDone = totalDue === 0 && newCount === 0

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          onRefresh={onRefresh}
          refreshing={isRefetching}
          tintColor={accentColor}
        />
      }
    >
      <Text className="px-1 text-[13px] text-muted">{eyebrow}</Text>

      {header}

      <GroupedSection title={t("today.todoTitle")}>
        <GroupedCard>
          {isAllDone ? (
            <GroupedRow
              icon={CheckmarkCircle02Icon}
              label={t("review.allCompleted")}
            />
          ) : (
            <>
              <GroupedRow
                icon={RefreshIcon}
                label={t("today.todoDue")}
                onPress={onStartReview}
                value={totalDue}
              />
              <RowSeparator />
              <GroupedRow
                icon={SparklesIcon}
                label={t("today.todoNew")}
                onPress={onStartReview}
                value={newCount}
              />
            </>
          )}
        </GroupedCard>
      </GroupedSection>

      {footer}
    </ScrollView>
  )
}
