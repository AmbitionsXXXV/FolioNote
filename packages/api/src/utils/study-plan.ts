/**
 * Daily vocabulary plan rules, kept pure so they are easy to test.
 *
 * Reviews come first and are unlimited unless the reader set a cap. New words
 * follow up to the daily target, which halves while the review backlog is
 * large so the pile can shrink instead of growing every day.
 */

export const DAILY_NEW_WORD_OPTIONS = [5, 10, 15, 20, 30] as const
export const DEFAULT_DAILY_NEW_WORDS = 10
export const DAILY_REVIEW_LIMIT_OPTIONS = [100, 200] as const
/** Due cards above this count halve today's new-word target. */
export const REVIEW_BACKLOG_THRESHOLD = 100

export interface PlanTodayInput {
  dailyNewWords: number
  /** Null means every due card is offered. */
  dailyReviewLimit: number | null
  newDone: number
  reviewDone: number
  /** Cards due right now across all of the reader's decks. */
  dueNow: number
}

export interface PlanToday {
  newTarget: number
  newRemaining: number
  /** Null when reviews are uncapped. */
  reviewRemaining: number | null
  backlogged: boolean
}

export const planToday = (input: PlanTodayInput): PlanToday => {
  const backlogged = input.dueNow > REVIEW_BACKLOG_THRESHOLD
  const newTarget = backlogged
    ? Math.ceil(input.dailyNewWords / 2)
    : input.dailyNewWords
  return {
    newTarget,
    newRemaining: Math.max(0, newTarget - input.newDone),
    reviewRemaining:
      input.dailyReviewLimit === null
        ? null
        : Math.max(0, input.dailyReviewLimit - input.reviewDone),
    backlogged
  }
}

/** How far back an offline rating may be dated when it is replayed. */
export const MAX_REPLAY_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * When an offline rating counts: the moment the reader rated the card, never
 * in the future and never older than a week (older replays count as now).
 */
export const replayTime = (occurredAt: Date | undefined, now: Date): Date => {
  if (!occurredAt) return now
  const at = occurredAt.getTime()
  if (at > now.getTime()) return now
  if (now.getTime() - at > MAX_REPLAY_AGE_MS) return now
  return occurredAt
}
