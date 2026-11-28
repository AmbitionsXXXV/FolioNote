/**
 * Pure rules for the daily check-in (打卡) and streak.
 *
 * Kept free of database access so the calendar math can be unit tested and
 * shared by every caller that records a learning activity.
 */

export const ACTIVITY_KINDS = [
  "entry_review",
  "vocab_review",
  "vocab_new",
  "entry_create",
  "article_read",
  "exam_complete",
  "listen_complete"
] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const STUDY_LANGUAGES = ["ja", "en"] as const
export type StudyLanguage = (typeof STUDY_LANGUAGES)[number]

/** Key used in daily_logs.counts for activities without a language. */
export const OTHER_LANGUAGE_KEY = "other"

export const ACTIVITY_POINTS: Record<ActivityKind, number> = {
  entry_review: 1,
  vocab_review: 1,
  vocab_new: 2,
  entry_create: 2,
  article_read: 5,
  exam_complete: 10,
  // Finishing a video is roughly an article's worth of reading practice.
  listen_complete: 5
}

export const DEFAULT_DAILY_GOAL = 20
export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const
export const DEFAULT_DAY_START_HOUR = 4
export const MAX_FREEZES = 2
/** A freeze is earned every time the streak reaches a multiple of this. */
export const FREEZE_EARN_INTERVAL = 7
export const STREAK_MILESTONES = [3, 7, 14, 30, 100, 180, 365] as const

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Whether the runtime knows this IANA time zone name. */
export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    return Boolean(new Intl.DateTimeFormat("en-US", { timeZone }))
  } catch {
    return false
  }
}

/**
 * The user's study day (YYYY-MM-DD) for an instant. The day starts at
 * `dayStartHour` local time, so studying at 1 AM still counts for yesterday.
 */
export const getLocalDate = (
  at: Date,
  timeZone: string,
  dayStartHour = DEFAULT_DAY_START_HOUR
): string => {
  const shifted = new Date(at.getTime() - dayStartHour * HOUR_MS)
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(shifted)
}

const parseLocalDate = (date: string): number => {
  if (!LOCAL_DATE_PATTERN.test(date)) {
    throw new Error(`Invalid local date: ${date}`)
  }
  return Date.parse(`${date}T00:00:00Z`)
}

export const addDays = (date: string, days: number): string =>
  new Date(parseLocalDate(date) + days * DAY_MS).toISOString().slice(0, 10)

/** Whole days from `from` to `to` (positive when `to` is later). */
export const diffDays = (from: string, to: string): number =>
  Math.round((parseLocalDate(to) - parseLocalDate(from)) / DAY_MS)

/** ISO weekday, Monday = 1 … Sunday = 7. */
export const isoWeekday = (date: string): number => {
  const day = new Date(parseLocalDate(date)).getUTCDay()
  return day === 0 ? 7 : day
}

export interface StreakSnapshot {
  currentDays: number
  longestDays: number
  startedOn: string | null
  lastActiveOn: string | null
  freezes: number
}

export interface StreakAdvance {
  next: StreakSnapshot
  /** First activity of the day: the day gets its stamp. */
  justCheckedIn: boolean
  /** Missed days covered by freezes, oldest first. */
  frozenDates: string[]
  earnedFreeze: boolean
  streakReset: boolean
  /** Milestone (in days) reached by this check-in, if any. */
  newMilestone: number | null
}

/**
 * Advance the streak for an activity on `today`. Missed days are covered by
 * freezes when there are enough of them; frozen days keep the streak alive
 * but do not add to it.
 */
export const advanceStreak = (
  snapshot: StreakSnapshot,
  today: string
): StreakAdvance => {
  const unchanged: StreakAdvance = {
    next: snapshot,
    justCheckedIn: false,
    frozenDates: [],
    earnedFreeze: false,
    streakReset: false,
    newMilestone: null
  }
  // Same day, or an activity replayed from an earlier offline day.
  if (
    snapshot.lastActiveOn !== null &&
    diffDays(snapshot.lastActiveOn, today) <= 0
  ) {
    return unchanged
  }

  let { currentDays, freezes, startedOn } = snapshot
  const frozenDates: string[] = []
  let streakReset = false

  const missedDays =
    snapshot.lastActiveOn === null || currentDays === 0
      ? Number.POSITIVE_INFINITY
      : diffDays(snapshot.lastActiveOn, today) - 1

  if (missedDays === 0) {
    currentDays += 1
  } else if (missedDays <= freezes) {
    for (let i = 1; i <= missedDays; i++) {
      frozenDates.push(addDays(snapshot.lastActiveOn as string, i))
    }
    freezes -= missedDays
    currentDays += 1
  } else {
    streakReset = currentDays > 0
    currentDays = 1
    startedOn = today
  }
  startedOn ??= today

  let earnedFreeze = false
  if (currentDays % FREEZE_EARN_INTERVAL === 0 && freezes < MAX_FREEZES) {
    freezes += 1
    earnedFreeze = true
  }

  const newMilestone = (STREAK_MILESTONES as readonly number[]).includes(
    currentDays
  )
    ? currentDays
    : null

  return {
    next: {
      currentDays,
      longestDays: Math.max(snapshot.longestDays, currentDays),
      startedOn,
      lastActiveOn: today,
      freezes
    },
    justCheckedIn: true,
    frozenDates,
    earnedFreeze,
    streakReset,
    newMilestone
  }
}

/**
 * The streak to show on `today` without recording anything: still alive when
 * yesterday was active, or when the missed days can be covered by freezes.
 */
export const displayStreak = (
  snapshot: StreakSnapshot,
  today: string
): number => {
  if (snapshot.lastActiveOn === null || snapshot.currentDays === 0) return 0
  const missedDays = diffDays(snapshot.lastActiveOn, today) - 1
  if (missedDays <= 0) return snapshot.currentDays
  return missedDays <= snapshot.freezes ? snapshot.currentDays : 0
}

/**
 * Seed a streak from days that already had study activity (the pre-existing
 * review history), counting back from the day before `today`.
 */
export const seedStreakFromDates = (
  activeDates: Iterable<string>,
  today: string
): StreakSnapshot => {
  const dates = new Set(activeDates)
  let cursor = addDays(today, -1)
  let currentDays = 0
  while (dates.has(cursor)) {
    currentDays += 1
    cursor = addDays(cursor, -1)
  }
  return {
    currentDays,
    longestDays: currentDays,
    startedOn: currentDays > 0 ? addDays(today, -currentDays) : null,
    lastActiveOn: currentDays > 0 ? addDays(today, -1) : null,
    freezes: 0
  }
}

/** The next milestone above the current streak, or null past the last. */
export const nextMilestone = (currentDays: number): number | null =>
  STREAK_MILESTONES.find((days) => days > currentDays) ?? null

export const languageKey = (language: StudyLanguage | null): string =>
  language ?? OTHER_LANGUAGE_KEY
