import { formatDate } from "@folionote/locales"
import { Button } from "@folionote/ui/button"
import { Skeleton } from "@folionote/ui/skeleton"
import { Textarea } from "@folionote/ui/textarea"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { DayStamp } from "@/components/streak/day-stamp"
import {
  getBrowserTimeZone,
  shiftMonth,
  studyDayToDate
} from "@/components/streak/streak-utils"
import type { StudyDayStatus } from "@/components/streak/streak-utils"
import { Surface } from "@/components/surface"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
})

export const Route = createFileRoute("/_app/record")({
  validateSearch: searchSchema,
  component: RecordPage
})

/** Monday-first blanks before the 1st of the month. */
const leadingBlanks = (month: string): number => {
  const weekday = studyDayToDate(`${month}-01`).getUTCDay()
  return weekday === 0 ? 6 : weekday - 1
}

const daysIn = (month: string): number => {
  const [year, monthIndex] = month.split("-").map(Number)
  return new Date(
    Date.UTC(year as number, monthIndex as number, 0)
  ).getUTCDate()
}

/** Any Monday; the following six days give localized weekday labels. */
const SAMPLE_MONDAY_DAY = 23

/** The word or note title stored with an activity, when there is one. */
const activityDetail = (
  meta: Record<string, unknown> | null
): string | null => {
  if (typeof meta?.term === "string") return meta.term
  if (typeof meta?.title === "string" && meta.title.length > 0)
    return meta.title
  return null
}

function StatTile({
  label,
  value,
  accent = false
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Surface className="flex flex-col gap-1 px-5 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-black tabular-nums",
          accent && "text-stamp"
        )}
      >
        {value}
      </span>
    </Surface>
  )
}

function DayDetail({ date }: { date: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(
    orpc.streak.getDay.queryOptions({ input: { date } })
  )
  const [note, setNote] = useState("")
  useEffect(() => {
    setNote(data?.note ?? "")
  }, [data?.note])

  const saveNote = useMutation(
    orpc.streak.saveDayNote.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.streak.getDay.key({ input: { date } })
        })
        toast.success(t("streak.calendar.noteSaved"))
      },
      onError: () => {
        toast.error(t("streak.calendar.noteFailed"))
      }
    })
  )

  const heading = formatDate(studyDayToDate(date), {
    locale: i18n.language,
    options: {
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC"
    }
  })

  return (
    <Surface
      aria-label={t("streak.calendar.dayDetail")}
      className="flex flex-col gap-4 p-6"
      role="region"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{heading}</h2>
        {data && data.points > 0 && (
          <span className="text-sm font-bold text-primary">
            {t("streak.calendar.dayPoints", { count: data.points })}
            {data.status === "goal_met" && ` · ${t("streak.status.goal_met")}`}
          </span>
        )}
      </div>

      {isLoading && <Skeleton className="h-40 rounded-2xl" />}
      {data && data.activities.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {data.status === "frozen"
            ? t("streak.status.frozen")
            : t("streak.calendar.noActivity")}
        </p>
      )}
      {data && data.activities.length > 0 && (
        <ol className="flex flex-col">
          {data.activities.map((activity) => {
            const label = [
              activity.language ? t(`streak.lang.${activity.language}`) : null,
              t(`streak.kinds.${activity.kind}`)
            ]
              .filter(Boolean)
              .join(" · ")
            const detail = activityDetail(activity.meta)
            return (
              <li
                className="grid grid-cols-[3rem_1fr_auto] items-start gap-3 border-b border-border/60 py-3 last:border-b-0"
                key={activity.id}
              >
                <span className="pt-0.5 text-xs text-muted-foreground tabular-nums">
                  {formatDate(activity.occurredAt, {
                    locale: i18n.language,
                    options: { hour: "2-digit", minute: "2-digit" }
                  })}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold">{label}</span>
                  {detail && (
                    <span className="truncate text-xs text-muted-foreground">
                      {detail}
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold text-primary">
                  +{activity.points}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <label
        className="mt-auto text-xs text-muted-foreground"
        htmlFor="record-day-note"
      >
        {t("streak.calendar.noteLabel")}
      </label>
      <Textarea
        className="resize-none"
        id="record-day-note"
        maxLength={280}
        onBlur={() => {
          if (note.trim() === (data?.note ?? "")) return
          saveNote.mutate({ date, note })
        }}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("streak.calendar.notePlaceholder")}
        rows={2}
        value={note}
      />
    </Surface>
  )
}

function RecordPage() {
  const { t, i18n } = useTranslation()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const timeZone = getBrowserTimeZone()

  const today = useQuery(
    orpc.streak.getToday.queryOptions({ input: { timeZone } })
  )
  const todayDate = today.data?.today
  const month = search.month ?? todayDate?.slice(0, 7)
  const selectedDay = search.day ?? todayDate

  const calendar = useQuery({
    ...orpc.streak.getCalendar.queryOptions({
      input: { month: month ?? "2000-01", timeZone }
    }),
    enabled: month !== undefined
  })

  const byDate = new Map(
    (calendar.data?.days ?? []).map((day) => [day.date, day])
  )
  const totals = calendar.data?.totals

  const monthTitle = month
    ? formatDate(studyDayToDate(`${month}-01`), {
        locale: i18n.language,
        options: { year: "numeric", month: "long", timeZone: "UTC" }
      })
    : ""

  const goToMonth = (delta: number) => {
    if (!month) return
    navigate({ search: { month: shiftMonth(month, delta) } })
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    formatDate(studyDayToDate(`2026-11-${SAMPLE_MONDAY_DAY + i}`), {
      locale: i18n.language,
      options: { weekday: "narrow", timeZone: "UTC" }
    })
  )

  return (
    <PageContainer>
      <PageHeader
        description={t("activity.description")}
        icon={Calendar03Icon}
        title={t("streak.record")}
      />

      {today.isError && (
        <p className="text-sm text-destructive">
          {t("streak.calendar.loadFailed")}
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          accent
          label={t("streak.calendar.currentStreak")}
          value={t("streak.days", { count: today.data?.currentDays ?? 0 })}
        />
        <StatTile
          label={t("streak.calendar.studyDays")}
          value={t("streak.days", { count: totals?.studyDays ?? 0 })}
        />
        <StatTile
          label={t("streak.calendar.monthPoints")}
          value={String(totals?.points ?? 0)}
        />
        <StatTile
          label={t("streak.calendar.goalMetDays")}
          value={t("streak.calendar.goalMetValue", {
            count: totals?.goalMetDays ?? 0,
            total: totals?.studyDays ?? 0
          })}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <Surface
          aria-label={monthTitle}
          className="flex flex-col gap-4 p-6"
          role="region"
        >
          <div className="flex items-center justify-between">
            <Button
              aria-label={t("streak.calendar.prevMonth")}
              onClick={() => goToMonth(-1)}
              size="icon"
              variant="ghost"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <h2 className="text-lg font-bold">{monthTitle}</h2>
            <Button
              aria-label={t("streak.calendar.nextMonth")}
              disabled={!month || !todayDate || month >= todayDate.slice(0, 7)}
              onClick={() => goToMonth(1)}
              size="icon"
              variant="ghost"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground">
            {weekdayLabels.map((label, i) => (
              <span key={`weekday-${String(i)}`}>{label}</span>
            ))}
          </div>

          {month && (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: leadingBlanks(month) }, (_, i) => (
                <span aria-hidden="true" key={`blank-${String(i)}`} />
              ))}
              {Array.from({ length: daysIn(month) }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, "0")}`
                const day = byDate.get(date)
                const status: StudyDayStatus = day?.status ?? null
                const isToday = date === todayDate
                const isFuture = todayDate !== undefined && date > todayDate
                const isSelected = date === selectedDay
                const statusKey =
                  status ?? (isFuture || isToday ? "future" : "none")
                return (
                  <button
                    aria-label={`${i + 1} · ${t(`streak.status.${statusKey}`)}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex h-18 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border p-1 transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-transparent",
                      !isSelected &&
                        !isFuture &&
                        "bg-surface-secondary/60 hover:bg-surface-secondary",
                      isFuture && "pointer-events-none"
                    )}
                    disabled={isFuture}
                    key={date}
                    onClick={() => navigate({ search: { month, day: date } })}
                    type="button"
                  >
                    <span
                      className={cn(
                        "text-[11px] leading-none tabular-nums",
                        isToday
                          ? "font-bold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {isToday ? t("streak.today") : i + 1}
                    </span>
                    <DayStamp
                      className="size-8.5 text-[13px]"
                      date={date}
                      freezeMark={t("streak.freezeMark")}
                      isFuture={isFuture}
                      isToday={isToday}
                      mark={t("streak.stampMark")}
                      status={status}
                    />
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-4 rounded-full border-2 border-stamp" />
              {t("streak.status.active")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-4 rounded-full bg-stamp" />
              {t("streak.status.goal_met")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-4 rounded-full border-2 border-dashed border-freeze" />
              {t("streak.status.frozen")}
            </span>
          </div>
        </Surface>

        {selectedDay && <DayDetail date={selectedDay} />}
      </div>
    </PageContainer>
  )
}
