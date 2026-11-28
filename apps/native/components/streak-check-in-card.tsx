import { formatDate } from "@folionote/locales"
import { useQuery } from "@tanstack/react-query"
import { cn } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { useStampGlyph } from "@/lib/stamp-glyph"
import { getDeviceTimeZone, studyDayToDate } from "@/lib/study-day"
import { orpc } from "@/utils/orpc"

type DayStatus = "active" | "goal_met" | "frozen" | null

/** Alternate tilt so a row of stamps looks hand-pressed. */
const tiltOf = (date: string) =>
  Number(date.slice(-2)) % 2 === 0 ? "6deg" : "-8deg"

function WeekStamp({
  date,
  status,
  isToday,
  mark,
  freezeMark
}: {
  date: string
  status: DayStatus
  isToday: boolean
  mark: string
  freezeMark: string
}) {
  const base = "size-10 items-center justify-center rounded-full"
  if (status === "frozen") {
    return (
      <View className={cn(base, "border-2 border-dashed border-freeze")}>
        <Text className="text-sm font-bold text-freeze">{freezeMark}</Text>
      </View>
    )
  }
  if (status === "goal_met" || status === "active") {
    const solid = status === "goal_met"
    return (
      <View
        className={cn(base, solid ? "bg-stamp" : "border-[2.5px] border-stamp")}
        style={{ transform: [{ rotate: tiltOf(date) }] }}
      >
        <Text
          className={cn(
            "text-sm font-black",
            solid ? "text-stamp-foreground" : "text-stamp"
          )}
        >
          {mark}
        </Text>
      </View>
    )
  }
  if (isToday) {
    return (
      <View
        className={cn(
          base,
          "border-2 border-dashed border-muted/50 bg-surface"
        )}
      >
        <Text className="text-base text-muted">+</Text>
      </View>
    )
  }
  return <View className={cn(base, "bg-surface-tertiary")} />
}

/**
 * Today's check-in on iPhone: the streak seal, this week's stamps and the
 * daily goal. Server-backed, so it stays hidden offline or signed out.
 */
export function StreakCheckInCard({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation()
  const stampGlyph = useStampGlyph()
  const { data } = useQuery({
    ...orpc.streak.getToday.queryOptions({
      input: { timeZone: getDeviceTimeZone() }
    }),
    enabled
  })
  if (!data) return null

  const ratio =
    data.dailyGoal > 0 ? Math.min(data.todayPoints / data.dailyGoal, 1) : 0
  const remaining = Math.max(data.dailyGoal - data.todayPoints, 0)
  const isEmpty = data.currentDays === 0

  return (
    <View className="mb-4 gap-4 rounded-3xl bg-surface p-5">
      <View className="flex-row items-center gap-4">
        <View
          accessibilityLabel={t("streak.stampAria", {
            count: data.currentDays
          })}
          accessibilityRole="image"
          className={cn(
            "size-22 items-center justify-center rounded-full border-4",
            isEmpty ? "border-muted/30" : "border-stamp"
          )}
        >
          <View
            className={cn(
              "absolute size-19 rounded-full border border-dashed",
              isEmpty ? "border-muted/30" : "border-stamp"
            )}
          />
          <View
            className="items-center"
            style={{ transform: [{ rotate: "-8deg" }] }}
          >
            <Text
              className={cn(
                "text-3xl font-black",
                isEmpty ? "text-muted" : "text-stamp"
              )}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {data.currentDays}
            </Text>
            <Text
              className={cn(
                "text-[10px] font-bold tracking-widest",
                isEmpty ? "text-muted" : "text-stamp"
              )}
            >
              {t("streak.stampLabel")}
            </Text>
          </View>
        </View>

        <View className="flex-1 gap-1">
          <Text className="text-sm text-muted">{t("streak.currentLabel")}</Text>
          <Text className="text-2xl font-black text-foreground">
            {t("streak.days", { count: data.currentDays })}
          </Text>
          <Text className="text-xs text-muted">
            {t("streak.freezes", { count: data.freezes })}
            {" · "}
            {t("streak.longest", { count: data.longestDays })}
          </Text>
        </View>
      </View>

      <View
        accessibilityLabel={t("streak.week")}
        className="flex-row justify-between"
      >
        {data.week.map((day) => {
          const isToday = day.date === data.today
          return (
            <View className="items-center gap-1.5" key={day.date}>
              <Text
                className={cn(
                  "text-[11px]",
                  isToday ? "font-bold text-foreground" : "text-muted"
                )}
              >
                {isToday
                  ? t("streak.today")
                  : formatDate(studyDayToDate(day.date), {
                      locale: i18n.language,
                      options: { weekday: "narrow", timeZone: "UTC" }
                    })}
              </Text>
              <WeekStamp
                date={day.date}
                freezeMark={t("streak.freezeMark")}
                isToday={isToday}
                mark={stampGlyph ?? t("streak.stampMark")}
                status={day.status}
              />
            </View>
          )
        })}
      </View>

      <View
        accessibilityLabel={t("streak.goalAria", {
          points: data.todayPoints,
          goal: data.dailyGoal
        })}
        className="gap-2"
      >
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-semibold text-foreground">
            {t("streak.goalTitle")}
          </Text>
          <Text className="text-sm text-muted">
            {remaining === 0
              ? t("streak.goalMet")
              : t("streak.goalRemaining", { count: remaining })}
          </Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
          <View
            className="h-2 rounded-full bg-accent"
            style={{ width: `${ratio * 100}%` }}
          />
        </View>
        {data.atRisk && (
          <Text className="text-xs font-medium text-stamp">
            {t("streak.atRisk", { hour: data.dayStartHour })}
          </Text>
        )}
      </View>
    </View>
  )
}
