import {
  dailyLogs,
  db,
  learningActivities,
  userMilestones,
  userStreaks
} from "@folionote/db"
import { ORPCError } from "@orpc/server"
import { and, asc, between, desc, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { protectedProcedure } from "../index"
import {
  loadStreakSettings,
  recentDates,
  resolveSnapshot,
  resolveTimeZone
} from "../utils/learning-activity"
import type { StreakSettings } from "../utils/learning-activity"
import {
  addDays,
  DAILY_GOAL_OPTIONS,
  displayStreak,
  getLocalDate,
  MAX_FREEZES,
  nextMilestone,
  STUDY_LANGUAGES
} from "../utils/streak"
import { TimeZoneSchema } from "../utils/time-zone-schema"

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const WEEK_DAYS = 7

type DayStatus = "active" | "goal_met" | "frozen" | null

const toStatus = (value: string | null): DayStatus =>
  value === "active" || value === "goal_met" || value === "frozen"
    ? value
    : null

const daysInMonth = (month: string): number => {
  const [year, monthIndex] = month.split("-").map(Number)
  return new Date(
    Date.UTC(year as number, monthIndex as number, 0)
  ).getUTCDate()
}

/** Remember the client's time zone so writes without one use the same day. */
const rememberTimeZone = async (
  userId: string,
  settings: StreakSettings,
  timeZone: string
) => {
  if (settings.persisted && settings.timeZone === timeZone) return
  await db
    .insert(userStreaks)
    .values({ userId, timezone: timeZone })
    .onConflictDoUpdate({
      target: userStreaks.userId,
      set: { timezone: timeZone, updatedAt: new Date() }
    })
}

/**
 * streak.getToday - Today's check-in: stamp, goal ring, week strip and
 * per-language counts.
 */
const getToday = protectedProcedure
  .input(z.object({ timeZone: TimeZoneSchema }).optional())
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const settings = await loadStreakSettings(db, userId)
    const timeZone = resolveTimeZone(settings, input?.timeZone)
    await rememberTimeZone(userId, settings, timeZone)
    const today = getLocalDate(new Date(), timeZone, settings.dayStartHour)
    const week = recentDates(today, WEEK_DAYS)

    const logs = await db
      .select({
        date: dailyLogs.date,
        points: dailyLogs.points,
        goalPoints: dailyLogs.goalPoints,
        status: dailyLogs.status,
        counts: dailyLogs.counts
      })
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          between(dailyLogs.date, week[0] as string, today)
        )
      )
    const byDate = new Map(logs.map((log) => [log.date, log]))
    const todayLog = byDate.get(today)
    const snapshot = await resolveSnapshot(
      db,
      userId,
      settings,
      today,
      timeZone
    )
    const currentDays = displayStreak(snapshot, today)
    const checkedIn = toStatus(todayLog?.status ?? null) !== null

    return {
      today,
      timeZone,
      dayStartHour: settings.dayStartHour,
      currentDays,
      longestDays: snapshot.longestDays,
      freezes: snapshot.freezes,
      maxFreezes: MAX_FREEZES,
      checkedIn,
      /** A live streak that ends tonight unless the user studies. */
      atRisk: currentDays > 0 && !checkedIn,
      todayPoints: todayLog?.points ?? 0,
      dailyGoal: todayLog?.goalPoints ?? settings.dailyGoal,
      counts: todayLog?.counts ?? {},
      nextMilestone: nextMilestone(currentDays),
      remindAt: settings.remindAt,
      languages: settings.languages,
      week: week.map((date) => {
        const log = byDate.get(date)
        return {
          date,
          points: log?.points ?? 0,
          status: toStatus(log?.status ?? null)
        }
      })
    }
  })

/**
 * streak.getCalendar - One month of stamps plus the month's totals.
 */
const getCalendar = protectedProcedure
  .input(z.object({ month: MonthSchema, timeZone: TimeZoneSchema }))
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const settings = await loadStreakSettings(db, userId)
    const timeZone = resolveTimeZone(settings, input.timeZone)
    const today = getLocalDate(new Date(), timeZone, settings.dayStartHour)
    const first = `${input.month}-01`
    const last = addDays(first, daysInMonth(input.month) - 1)

    const logs = await db
      .select({
        date: dailyLogs.date,
        points: dailyLogs.points,
        goalPoints: dailyLogs.goalPoints,
        status: dailyLogs.status
      })
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, userId), between(dailyLogs.date, first, last))
      )
      .orderBy(asc(dailyLogs.date))

    const days = logs.map((log) => ({
      date: log.date,
      points: log.points,
      goalPoints: log.goalPoints,
      status: toStatus(log.status)
    }))
    const studied = days.filter(
      (day) => day.status === "active" || day.status === "goal_met"
    )

    return {
      month: input.month,
      today,
      currentDays: displayStreak(
        await resolveSnapshot(db, userId, settings, today, timeZone),
        today
      ),
      days,
      totals: {
        studyDays: studied.length,
        goalMetDays: days.filter((day) => day.status === "goal_met").length,
        frozenDays: days.filter((day) => day.status === "frozen").length,
        points: days.reduce((sum, day) => sum + day.points, 0)
      }
    }
  })

/**
 * streak.getDay - What was studied on one day, newest last.
 */
const getDay = protectedProcedure
  .input(z.object({ date: LocalDateSchema }))
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const [log] = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, input.date)))
      .limit(1)
    const activities = await db
      .select({
        id: learningActivities.id,
        kind: learningActivities.kind,
        refId: learningActivities.refId,
        language: learningActivities.language,
        points: learningActivities.points,
        occurredAt: learningActivities.occurredAt,
        meta: learningActivities.meta
      })
      .from(learningActivities)
      .where(
        and(
          eq(learningActivities.userId, userId),
          eq(learningActivities.localDate, input.date)
        )
      )
      .orderBy(asc(learningActivities.occurredAt))

    return {
      date: input.date,
      points: log?.points ?? 0,
      goalPoints: log?.goalPoints ?? null,
      status: toStatus(log?.status ?? null),
      counts: log?.counts ?? {},
      note: log?.summary ?? null,
      activities
    }
  })

/**
 * streak.saveDayNote - The optional one-line reflection for a day.
 */
const saveDayNote = protectedProcedure
  .input(
    z.object({
      date: LocalDateSchema,
      note: z.string().trim().max(280)
    })
  )
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const settings = await loadStreakSettings(db, userId)
    const today = getLocalDate(
      new Date(),
      settings.timeZone,
      settings.dayStartHour
    )
    // Allow a day of slack for clients whose clock is ahead of the server's view.
    if (input.date > addDays(today, 1)) {
      throw new ORPCError("BAD_REQUEST", { message: "Date is in the future" })
    }
    const summary = input.note.length > 0 ? input.note : null
    await db
      .insert(dailyLogs)
      .values({
        id: nanoid(),
        userId,
        date: input.date,
        goalPoints: settings.dailyGoal,
        summary
      })
      .onConflictDoUpdate({
        target: [dailyLogs.userId, dailyLogs.date],
        set: { summary, updatedAt: new Date() }
      })
    return { date: input.date, note: summary }
  })

const RemindAtSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()

/**
 * streak.updateSettings - Daily goal, reminder, day start and languages.
 */
const updateSettings = protectedProcedure
  .input(
    z.object({
      dailyGoal: z
        .number()
        .int()
        .refine(
          (goal) => (DAILY_GOAL_OPTIONS as readonly number[]).includes(goal),
          { message: "Unsupported daily goal" }
        )
        .optional(),
      remindAt: RemindAtSchema.optional(),
      dayStartHour: z.number().int().min(0).max(6).optional(),
      languages: z.array(z.enum(STUDY_LANGUAGES)).min(1).max(2).optional(),
      timeZone: TimeZoneSchema
    })
  )
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const changes = {
      ...(input.dailyGoal === undefined ? {} : { dailyGoal: input.dailyGoal }),
      ...(input.remindAt === undefined ? {} : { remindAt: input.remindAt }),
      ...(input.dayStartHour === undefined
        ? {}
        : { dayStartHour: input.dayStartHour }),
      ...(input.languages === undefined ? {} : { languages: input.languages }),
      ...(input.timeZone === undefined ? {} : { timezone: input.timeZone })
    }
    const [saved] = await db
      .insert(userStreaks)
      .values({ userId, ...changes })
      .onConflictDoUpdate({
        target: userStreaks.userId,
        set: { ...changes, updatedAt: new Date() }
      })
      .returning({
        dailyGoal: userStreaks.dailyGoal,
        remindAt: userStreaks.remindAt,
        dayStartHour: userStreaks.dayStartHour,
        languages: userStreaks.languages,
        timeZone: userStreaks.timezone
      })
    return saved
  })

/**
 * streak.getMilestones - Streak milestones reached so far, newest first.
 */
const getMilestones = protectedProcedure.handler(async ({ context }) => {
  const userId = context.session.user.id
  return await db
    .select({ key: userMilestones.key, achievedOn: userMilestones.achievedOn })
    .from(userMilestones)
    .where(eq(userMilestones.userId, userId))
    .orderBy(desc(userMilestones.achievedOn))
})

export const streakRouter = {
  getToday,
  getCalendar,
  getDay,
  saveDayNote,
  updateSettings,
  getMilestones
}
