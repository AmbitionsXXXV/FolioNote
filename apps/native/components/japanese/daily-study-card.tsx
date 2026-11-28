import { ArrowDown01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Button, PressableFeedback, useThemeColor } from "heroui-native"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import {
  DEFAULT_DECK,
  deckDue,
  deckKey,
  deckLabel
} from "@/lib/japanese/study-deck"
import { flushPendingRatings } from "@/lib/japanese/study-store"
import { getDeviceTimeZone } from "@/lib/study-day"
import { orpc } from "@/utils/orpc"

function Meter({
  label,
  done,
  total,
  barClassName
}: {
  label: string
  done: number
  total: number
  barClassName: string
}) {
  const ratio = total > 0 ? Math.min(1, done / total) : 1
  return (
    <View
      accessibilityLabel={`${label} ${done} / ${total}`}
      accessible
      className="flex-1 gap-1.5"
    >
      <Text className="text-[13px] text-muted">{label}</Text>
      <Text className="text-[22px] font-bold text-foreground tabular-nums">
        {done}
        <Text className="text-[15px] font-medium text-muted"> / {total}</Text>
      </Text>
      <View className="h-1.5 overflow-hidden rounded-full bg-default">
        <View
          className={`h-1.5 rounded-full ${barClassName}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </View>
    </View>
  )
}

/**
 * Top of the Japanese tab: today's new-word and review progress for the
 * chosen word book, and the button into a session.
 */
export function DailyStudyCard() {
  const { t } = useTranslation()
  const router = useRouter()
  const softForeground = useThemeColor("accent")
  const timeZone = getDeviceTimeZone()
  const plan = useQuery(
    orpc.japanese.study.plan.queryOptions({ input: { timeZone } })
  )
  const decks = useQuery(orpc.japanese.study.decks.queryOptions())

  // Ratings made offline go out as soon as the reader is back here.
  useEffect(() => {
    flushPendingRatings().catch(() => undefined)
  }, [])

  const deck = plan.data?.deck ?? DEFAULT_DECK
  const today = plan.data?.today
  const due = deckDue(deck, decks.data)
  const reviewTotal =
    (today?.reviewDone ?? 0) +
    (today?.reviewRemaining === null || today?.reviewRemaining === undefined
      ? due
      : Math.min(due, today.reviewRemaining))
  const newLeft = today?.newRemaining ?? 0
  const left = newLeft + Math.max(0, reviewTotal - (today?.reviewDone ?? 0))
  const started = (today?.newDone ?? 0) + (today?.reviewDone ?? 0) > 0
  const label = deckLabel(deck, decks.data, t)

  let action = t("japanese.daily.start")
  if (plan.data && left === 0) action = t("japanese.daily.moreNew")
  else if (started) action = t("japanese.daily.continue", { count: left })

  return (
    <View className="gap-3.5 rounded-3xl bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text
          accessibilityRole="header"
          className="text-xl font-bold text-foreground"
        >
          {t("japanese.daily.title")}
        </Text>
        <PressableFeedback
          accessibilityLabel={t("japanese.daily.changeBook", { name: label })}
          accessibilityRole="button"
          className="h-8 flex-row items-center gap-1 rounded-full bg-accent/15 pr-2.5 pl-3"
          onPress={() => router.push("/japanese/books")}
        >
          <Text className="text-sm font-semibold text-accent">{label}</Text>
          <HugeiconsIcon
            color={softForeground}
            icon={ArrowDown01Icon}
            size={14}
          />
        </PressableFeedback>
      </View>

      {plan.isError ? (
        <Text className="text-sm text-muted">
          {t("japanese.daily.offlineCard")}
        </Text>
      ) : (
        <View className="flex-row gap-4">
          <Meter
            barClassName="bg-accent"
            done={today?.newDone ?? 0}
            label={t("japanese.daily.new")}
            total={today?.newTarget ?? 0}
          />
          <Meter
            barClassName="bg-success"
            done={today?.reviewDone ?? 0}
            label={t("japanese.daily.review")}
            total={reviewTotal}
          />
        </View>
      )}
      {today?.backlogged ? (
        <Text className="text-xs text-muted">
          {t("japanese.daily.backlog")}
        </Text>
      ) : null}

      <Button
        className="h-[50px] rounded-full bg-accent"
        onPress={() =>
          router.push({
            pathname: "/japanese/study",
            params: {
              deck: deckKey(deck),
              ...(plan.data && left === 0 ? { extra: "5" } : {})
            }
          })
        }
      >
        <Button.Label className="text-[17px] font-semibold text-accent-foreground">
          {action}
        </Button.Label>
      </Button>
      <Text className="text-center text-xs text-muted">
        {t("japanese.daily.pointsHint")}
      </Text>
    </View>
  )
}
