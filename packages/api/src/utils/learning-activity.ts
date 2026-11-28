import {
  dailyLogs,
  db,
  learningActivities,
  reviewEvents,
  userMilestones,
  userStreaks
} from "@folionote/db"
import { and, eq, gte, sql } from "drizzle-orm"
import { nanoid } from "nanoid"

import {
  ACTIVITY_POINTS,
  addDays,
  advanceStreak,
  DEFAULT_DAILY_GOAL,
  DEFAULT_DAY_START_HOUR,
  getLocalDate,
  isValidTimeZone,
  languageKey,
  seedStreakFromDates
} from "./streak"
import type { ActivityKind, StreakSnapshot, StudyLanguage } from "./streak"

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
/** Either the pool or an open transaction, so callers can stay atomic. */
export type DbExecutor = typeof db | Transaction

export interface StreakSettings {
  snapshot: StreakSnapshot
  timeZone: string
  dayStartHour: number
  dailyGoal: number
  remindAt: string | null
  languages: string[]
  /** False until the user's first activity or settings change creates the row. */
  persisted: boolean
}

/** What a study mutation returns so clients can play the stamp animation. */
export interface LearningProgress {
  localDate: string
  pointsEarned: number
  todayPoints: number
  dailyGoal: number
  justCheckedIn: boolean
  justMetGoal: boolean
  currentDays: number
  freezes: number
  earnedFreeze: boolean
  newMilestone: number | null
}

export interface RecordActivityInput {
  userId: string
  kind: ActivityKind
  refId?: string | null
  language?: StudyLanguage | null
  meta?: Record<string, unknown>
  /** Client-generated id makes offline replays idempotent. */
  id?: string
  occurredAt?: Date
  /** IANA time zone reported by the client; remembered for later requests. */
  timeZone?: string
}

/** Load the user's streak row, falling back to defaults before it exists. */
export const loadStreakSettings = async (
  executor: DbExecutor,
  userId: string
): Promise<StreakSettings> => {
  const [row] = await executor
    .select()
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId))
    .limit(1)
  if (!row) {
    return {
      snapshot: {
        currentDays: 0,
        longestDays: 0,
        startedOn: null,
        lastActiveOn: null,
        freezes: 0
      },
      timeZone: "UTC",
      dayStartHour: DEFAULT_DAY_START_HOUR,
      dailyGoal: DEFAULT_DAILY_GOAL,
      remindAt: null,
      languages: ["ja"],
      persisted: false
    }
  }
  return {
    snapshot: {
      currentDays: row.currentDays,
      longestDays: row.longestDays,
      startedOn: row.startedOn,
      lastActiveOn: row.lastActiveOn,
      freezes: row.freezes
    },
    timeZone: row.timezone,
    dayStartHour: row.dayStartHour,
    dailyGoal: row.dailyGoal,
    remindAt: row.remindAt,
    languages: row.languages,
    persisted: true
  }
}

/** Prefer a valid client time zone over the stored one. */
export const resolveTimeZone = (
  settings: StreakSettings,
  clientTimeZone?: string
): string =>
  clientTimeZone && isValidTimeZone(clientTimeZone)
    ? clientTimeZone
    : settings.timeZone

const LEGACY_LOOKBACK_DAYS = 400

/**
 * Before user_streaks existed the streak was derived from review_events.
 * Seed the snapshot from that history once so nobody loses their streak.
 */
const seedFromReviewHistory = async (
  executor: DbExecutor,
  userId: string,
  today: string,
  timeZone: string,
  dayStartHour: number
): Promise<StreakSnapshot> => {
  const since = new Date(Date.now() - LEGACY_LOOKBACK_DAYS * 86_400_000)
  const rows = await executor
    .select({ reviewedAt: reviewEvents.reviewedAt })
    .from(reviewEvents)
    .where(
      and(eq(reviewEvents.userId, userId), gte(reviewEvents.reviewedAt, since))
    )
  const dates = rows.map((row) =>
    getLocalDate(row.reviewedAt, timeZone, dayStartHour)
  )
  return seedStreakFromDates(dates, today)
}

/**
 * The streak snapshot to use on `today`. Until the first activity is recorded
 * the snapshot is seeded from review history (and not written here).
 */
export const resolveSnapshot = async (
  executor: DbExecutor,
  userId: string,
  settings: StreakSettings,
  today: string,
  timeZone: string
): Promise<StreakSnapshot> =>
  settings.snapshot.lastActiveOn === null
    ? await seedFromReviewHistory(
        executor,
        userId,
        today,
        timeZone,
        settings.dayStartHour
      )
    : settings.snapshot

/**
 * Record one learning activity: append the event, add its points to the day,
 * and advance the streak on the day's first activity.
 *
 * Returns null when the activity id was already recorded (offline replay).
 */
export const recordLearningActivity = async (
  executor: DbExecutor,
  input: RecordActivityInput
): Promise<LearningProgress | null> => {
  const { userId, kind } = input
  const occurredAt = input.occurredAt ?? new Date()
  const settings = await loadStreakSettings(executor, userId)
  const timeZone = resolveTimeZone(settings, input.timeZone)
  const localDate = getLocalDate(occurredAt, timeZone, settings.dayStartHour)
  const points = ACTIVITY_POINTS[kind]
  const language = input.language ?? null

  const snapshot = await resolveSnapshot(
    executor,
    userId,
    settings,
    localDate,
    timeZone
  )

  const [activity] = await executor
    .insert(learningActivities)
    .values({
      id: input.id ?? nanoid(),
      userId,
      kind,
      refId: input.refId ?? null,
      language,
      points,
      localDate,
      occurredAt,
      meta: input.meta ?? null
    })
    .onConflictDoNothing()
    .returning({ id: learningActivities.id })
  if (!activity) return null

  const langKey = languageKey(language)
  // Atomic add so concurrent activities on the same day never lose points.
  const [day] = await executor
    .insert(dailyLogs)
    .values({
      id: nanoid(),
      userId,
      date: localDate,
      points,
      goalPoints: settings.dailyGoal,
      status: points >= settings.dailyGoal ? "goal_met" : "active",
      counts: { [langKey]: { [kind]: 1 } },
      firstActivityAt: occurredAt
    })
    .onConflictDoUpdate({
      target: [dailyLogs.userId, dailyLogs.date],
      set: {
        points: sql`${dailyLogs.points} + ${points}`,
        status: sql`case when ${dailyLogs.points} + ${points} >= ${dailyLogs.goalPoints} then 'goal_met' else 'active' end`,
        counts: sql`${dailyLogs.counts} || jsonb_build_object(${langKey}::text, coalesce(${dailyLogs.counts} -> ${langKey}::text, '{}'::jsonb) || jsonb_build_object(${kind}::text, coalesce((${dailyLogs.counts} -> ${langKey}::text ->> ${kind}::text)::int, 0) + 1))`,
        firstActivityAt: sql`coalesce(${dailyLogs.firstActivityAt}, ${occurredAt.toISOString()}::timestamptz)`,
        updatedAt: new Date()
      }
    })
    .returning({ points: dailyLogs.points, goalPoints: dailyLogs.goalPoints })

  const todayPoints = day?.points ?? points
  const dailyGoal = day?.goalPoints ?? settings.dailyGoal
  const advance = advanceStreak(snapshot, localDate)
  const next = advance.next

  await executor
    .insert(userStreaks)
    .values({
      userId,
      ...next,
      timezone: timeZone,
      dayStartHour: settings.dayStartHour,
      dailyGoal: settings.dailyGoal,
      remindAt: settings.remindAt,
      languages: settings.languages
    })
    .onConflictDoUpdate({
      target: userStreaks.userId,
      set: { ...next, timezone: timeZone, updatedAt: new Date() }
    })

  if (advance.frozenDates.length > 0) {
    await executor
      .insert(dailyLogs)
      .values(
        advance.frozenDates.map((date) => ({
          id: nanoid(),
          userId,
          date,
          goalPoints: settings.dailyGoal,
          status: "frozen"
        }))
      )
      .onConflictDoUpdate({
        target: [dailyLogs.userId, dailyLogs.date],
        set: { status: "frozen", updatedAt: new Date() }
      })
  }

  if (advance.newMilestone !== null) {
    await executor
      .insert(userMilestones)
      .values({
        userId,
        key: `streak_${advance.newMilestone}`,
        achievedOn: localDate
      })
      .onConflictDoNothing()
  }

  return {
    localDate,
    pointsEarned: points,
    todayPoints,
    dailyGoal,
    justCheckedIn: advance.justCheckedIn,
    justMetGoal: todayPoints >= dailyGoal && todayPoints - points < dailyGoal,
    currentDays: next.currentDays,
    freezes: next.freezes,
    earnedFreeze: advance.earnedFreeze,
    newMilestone: advance.newMilestone
  }
}

/** Local dates of the last `days` days ending at `today`, oldest first. */
export const recentDates = (today: string, days: number): string[] =>
  Array.from({ length: days }, (_, i) => addDays(today, i - days + 1))
