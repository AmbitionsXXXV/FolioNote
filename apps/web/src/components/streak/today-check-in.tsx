import { formatDate } from "@folionote/locales"
import { buttonVariants } from "@folionote/ui/button"
import { Skeleton } from "@folionote/ui/skeleton"
import {
  ArrowRight01Icon,
  Shield01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Surface } from "@/components/surface"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import { DayStamp } from "./day-stamp"
import { StreakSeal } from "./streak-seal"
import { getBrowserTimeZone, studyDayToDate } from "./streak-utils"

const RING_RADIUS = 50
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const LANGUAGE_CHIP_CLASS: Record<string, string> = {
  ja: "bg-primary/12 text-primary",
  en: "bg-freeze/12 text-freeze",
  other: "bg-surface-tertiary text-foreground"
}

export const streakTodayQueryOptions = () =>
  orpc.streak.getToday.queryOptions({
    input: { timeZone: getBrowserTimeZone() }
  })

function GoalRing({ points, goal }: { points: number; goal: number }) {
  const { t } = useTranslation()
  const ratio = goal > 0 ? Math.min(points / goal, 1) : 0
  return (
    <div className="relative size-30 shrink-0">
      <svg
        aria-label={t("streak.goalAria", { points, goal })}
        className="size-full -rotate-90"
        role="img"
        viewBox="0 0 120 120"
      >
        <circle
          className="stroke-surface-tertiary"
          cx="60"
          cy="60"
          fill="none"
          r={RING_RADIUS}
          strokeWidth="12"
        />
        <circle
          className="stroke-primary transition-[stroke-dasharray] duration-700 ease-out"
          cx="60"
          cy="60"
          fill="none"
          r={RING_RADIUS}
          strokeDasharray={`${ratio * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl leading-none font-black tabular-nums">
          {points}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("streak.pointsOf", { goal })}
        </span>
      </div>
    </div>
  )
}

/**
 * Today's check-in on the home page: the streak seal with this week's
 * stamps, and the daily goal ring with a per-language breakdown.
 */
export function TodayCheckIn() {
  const { t, i18n } = useTranslation()
  const { data, isLoading, isError } = useQuery(streakTodayQueryOptions())

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    )
  }
  if (isError || !data) return null

  const remaining = Math.max(data.dailyGoal - data.todayPoints, 0)
  const frozenThisWeek = data.week.filter((day) => day.status === "frozen")
  const languageChips = Object.entries(data.counts)
    .map(([language, kinds]) => ({
      language,
      count: Object.values(kinds).reduce((sum, value) => sum + value, 0)
    }))
    .filter((chip) => chip.count > 0)

  let headline = t("streak.headlineStart")
  if (data.checkedIn) {
    headline = t("streak.headlineCheckedIn", { count: data.currentDays })
  } else if (data.currentDays > 0) {
    headline = t("streak.headlineToCheckIn", { count: data.currentDays + 1 })
  }

  return (
    <section aria-label={t("streak.goalTitle")} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {headline}
        </h2>
        <Link
          className="group flex items-center gap-1 text-sm font-semibold text-primary"
          to="/record"
        >
          {t("streak.openRecord")}
          <HugeiconsIcon
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            icon={ArrowRight01Icon}
          />
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Surface className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-5">
            <StreakSeal
              ariaLabel={t("streak.stampAria", { count: data.currentDays })}
              days={data.currentDays}
              label={t("streak.stampLabel")}
              pressed={data.checkedIn}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">
                {t("streak.currentLabel")}
              </span>
              <span className="text-4xl leading-none font-black">
                {t("streak.days", { count: data.currentDays })}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("streak.longest", { count: data.longestDays })}
                {data.nextMilestone !== null &&
                  ` · ${t("streak.toMilestone", {
                    count: data.nextMilestone - data.currentDays,
                    milestone: data.nextMilestone
                  })}`}
              </span>
            </div>
            <div
              className="ml-auto flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2 text-sm"
              title={t("streak.freezeHint", { max: data.maxFreezes })}
            >
              <HugeiconsIcon
                className="size-5 text-freeze"
                icon={Shield01Icon}
              />
              {t("streak.freezes", { count: data.freezes })}
            </div>
          </div>

          <ol aria-label={t("streak.week")} className="grid grid-cols-7 gap-2">
            {data.week.map((day) => {
              const isToday = day.date === data.today
              const statusKey = day.status ?? (isToday ? "future" : "none")
              return (
                <li
                  aria-label={`${formatDate(studyDayToDate(day.date), {
                    locale: i18n.language,
                    options: { month: "short", day: "numeric", timeZone: "UTC" }
                  })} · ${t(`streak.status.${statusKey}`)}`}
                  className="flex flex-col items-center gap-2"
                  key={day.date}
                >
                  <span
                    className={cn(
                      "text-xs",
                      isToday
                        ? "font-bold text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {isToday
                      ? t("streak.today")
                      : formatDate(studyDayToDate(day.date), {
                          locale: i18n.language,
                          options: { weekday: "narrow", timeZone: "UTC" }
                        })}
                  </span>
                  <DayStamp
                    date={day.date}
                    freezeMark={t("streak.freezeMark")}
                    isToday={isToday}
                    mark={t("streak.stampMark")}
                    status={day.status}
                  />
                </li>
              )
            })}
          </ol>
          {frozenThisWeek.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("streak.frozenNote", { count: frozenThisWeek.length })}
            </p>
          )}
          {data.atRisk && (
            <p className="text-xs font-medium text-stamp">
              {t("streak.atRisk", { hour: data.dayStartHour })}
            </p>
          )}
        </Surface>

        <Surface className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-5">
            <GoalRing goal={data.dailyGoal} points={data.todayPoints} />
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">
                {t("streak.goalTitle")}
              </span>
              <span className="text-lg font-bold">
                {remaining === 0
                  ? t("streak.goalMet")
                  : t("streak.goalRemaining", { count: remaining })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("streak.goalHint")}
              </span>
            </div>
          </div>
          {languageChips.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              {languageChips.map((chip) => (
                <span
                  className={cn(
                    "rounded-full px-3 py-1",
                    LANGUAGE_CHIP_CLASS[chip.language] ??
                      LANGUAGE_CHIP_CLASS.other
                  )}
                  key={chip.language}
                >
                  <strong>{t(`streak.lang.${chip.language}`)}</strong>{" "}
                  {chip.count}
                </span>
              ))}
            </div>
          )}
          <Link
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-auto h-12 w-full text-base font-bold"
            )}
            to="/review"
          >
            {t("streak.continue")}
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Link>
        </Surface>
      </div>
    </section>
  )
}
