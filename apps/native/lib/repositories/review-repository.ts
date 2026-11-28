import { and, count, desc, eq, gte, lt, lte, sql } from "drizzle-orm"

import { localDb } from "../db"
import { entries, entryReviewState, reviewEvents } from "../db/schema"
import type {
  Entry,
  EntryReviewState,
  NewEntryReviewState,
  NewReviewEvent,
  ReviewEvent
} from "../db/schema"
import { generateLocalId, now } from "../db/utils"

/**
 * Review rating options
 */
export type ReviewRating = "again" | "hard" | "good" | "easy"

/**
 * Review mode options
 */
export type ReviewMode = "due" | "new" | "starred" | "unreviewed" | "all"

/**
 * Options for getting review queue
 */
export interface GetQueueOptions {
  limit?: number
  mode?: ReviewMode
  tzOffset?: number
  userId: string
}

/**
 * Today stats result
 * Matches the remote API response format
 */
export interface TodayStats {
  reviewedToday: number
  starredEntries: number
  streak: number
  totalEntries: number
  unreviewedEntries: number
}

/**
 * Due stats result
 * Matches the remote API response format
 */
export interface DueStats {
  dueToday: number
  newCount: number
  overdue: number
  upcoming: number
}

/**
 * SM-2 algorithm parameters
 */
const SM2_DEFAULTS = {
  initialEase: 2.5,
  minEase: 1.3,
  maxEase: 3,
  againInterval: 1,
  hardMultiplier: 1.2,
  easyMultiplier: 1.3,
  againEaseDelta: -0.2,
  hardEaseDelta: -0.15,
  easyEaseDelta: 0.1
}

/**
 * Calculate next review state based on rating (SM-2 algorithm)
 */
function calculateNextState(
  currentState: EntryReviewState | null,
  rating: ReviewRating
): { intervalDays: number; ease: number; reps: number; lapses: number } {
  const baseInterval = currentState?.intervalDays ?? 0
  let ease = currentState?.ease ?? SM2_DEFAULTS.initialEase
  let reps = currentState?.reps ?? 0
  let lapses = currentState?.lapses ?? 0
  let intervalDays: number

  switch (rating) {
    case "again": {
      intervalDays = SM2_DEFAULTS.againInterval
      ease = Math.max(SM2_DEFAULTS.minEase, ease + SM2_DEFAULTS.againEaseDelta)
      lapses += 1
      reps = 0
      break
    }
    case "hard": {
      intervalDays = Math.max(
        1,
        Math.round(baseInterval * SM2_DEFAULTS.hardMultiplier)
      )
      ease = Math.max(SM2_DEFAULTS.minEase, ease + SM2_DEFAULTS.hardEaseDelta)
      reps += 1
      break
    }
    case "good": {
      if (baseInterval === 0) {
        intervalDays = 1
      } else {
        intervalDays = Math.max(1, Math.round(baseInterval * ease))
      }
      reps += 1
      break
    }
    case "easy": {
      if (baseInterval === 0) {
        intervalDays = 2
      } else {
        intervalDays = Math.max(
          1,
          Math.round(baseInterval * ease * SM2_DEFAULTS.easyMultiplier)
        )
      }
      ease = Math.min(SM2_DEFAULTS.maxEase, ease + SM2_DEFAULTS.easyEaseDelta)
      reps += 1
      break
    }
    default: {
      // Default to 'good' behavior
      intervalDays =
        baseInterval === 0 ? 1 : Math.max(1, Math.round(baseInterval * ease))
      reps += 1
    }
  }

  return { intervalDays, ease, reps, lapses }
}

/**
 * Local review repository
 * Handles review state and events in SQLite
 */
export class ReviewRepository {
  /**
   * Get review queue
   */
  async getQueue(options: GetQueueOptions): Promise<Entry[]> {
    const { userId, mode = "due", limit = 50 } = options

    // Calculate today's start/end based on timezone offset
    const nowDate = new Date()

    switch (mode) {
      case "due": {
        // Get entries with dueAt <= now
        const result = await localDb
          .select({ entry: entries })
          .from(entries)
          .leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
          .where(
            and(
              eq(entries.userId, userId),
              sql`${entries.deletedAt} IS NULL`,
              lte(entryReviewState.dueAt, nowDate)
            )
          )
          .orderBy(entryReviewState.dueAt)
          .limit(limit)

        return result.map((r) => r.entry)
      }

      case "new": {
        // Get entries without review state
        const result = await localDb
          .select({ entry: entries })
          .from(entries)
          .leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
          .where(
            and(
              eq(entries.userId, userId),
              sql`${entries.deletedAt} IS NULL`,
              sql`${entryReviewState.entryId} IS NULL`
            )
          )
          .orderBy(desc(entries.createdAt))
          .limit(limit)

        return result.map((r) => r.entry)
      }

      case "starred": {
        const result = await localDb
          .select()
          .from(entries)
          .where(
            and(
              eq(entries.userId, userId),
              eq(entries.isStarred, true),
              sql`${entries.deletedAt} IS NULL`
            )
          )
          .orderBy(desc(entries.updatedAt))
          .limit(limit)

        return result
      }

      case "unreviewed": {
        // Get entries that have never been reviewed
        const result = await localDb
          .select({ entry: entries })
          .from(entries)
          .leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
          .where(
            and(
              eq(entries.userId, userId),
              sql`${entries.deletedAt} IS NULL`,
              sql`${entryReviewState.entryId} IS NULL`
            )
          )
          .orderBy(desc(entries.createdAt))
          .limit(limit)

        return result.map((r) => r.entry)
      }

      default: {
        // 'all' mode
        const result = await localDb
          .select()
          .from(entries)
          .where(
            and(eq(entries.userId, userId), sql`${entries.deletedAt} IS NULL`)
          )
          .orderBy(desc(entries.updatedAt))
          .limit(limit)

        return result
      }
    }
  }

  /**
   * Mark an entry as reviewed with rating
   */
  async markReviewed(
    userId: string,
    entryId: string,
    rating: ReviewRating = "good"
  ): Promise<EntryReviewState> {
    const timestamp = now()

    // Get current review state
    const currentState = await localDb
      .select()
      .from(entryReviewState)
      .where(eq(entryReviewState.entryId, entryId))
      .limit(1)

    // Calculate next state
    const nextState = calculateNextState(currentState[0] ?? null, rating)

    // Calculate next due date
    const dueAt = new Date(timestamp)
    dueAt.setDate(dueAt.getDate() + nextState.intervalDays)

    // Upsert review state
    if (currentState.length > 0) {
      await localDb
        .update(entryReviewState)
        .set({
          dueAt,
          lastReviewedAt: timestamp,
          intervalDays: nextState.intervalDays,
          ease: nextState.ease,
          reps: nextState.reps,
          lapses: nextState.lapses,
          updatedAt: timestamp,
          syncStatus: "pending"
        })
        .where(eq(entryReviewState.entryId, entryId))
    } else {
      const newState: NewEntryReviewState = {
        entryId,
        userId,
        dueAt,
        lastReviewedAt: timestamp,
        intervalDays: nextState.intervalDays,
        ease: nextState.ease,
        reps: nextState.reps,
        lapses: nextState.lapses,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: "pending"
      }
      await localDb.insert(entryReviewState).values(newState)
    }

    // Create review event
    const newEvent: NewReviewEvent = {
      id: generateLocalId(),
      userId,
      entryId,
      rating,
      scheduledDueAt: dueAt,
      reviewedAt: timestamp,
      createdAt: timestamp,
      syncStatus: "pending"
    }
    await localDb.insert(reviewEvents).values(newEvent)

    // Return updated state
    const result = await localDb
      .select()
      .from(entryReviewState)
      .where(eq(entryReviewState.entryId, entryId))
      .limit(1)

    const updatedState = result[0]
    if (!updatedState) {
      throw new Error("Failed to get updated review state")
    }
    return updatedState
  }

  /**
   * Snooze an entry (delay review)
   */
  async snooze(
    userId: string,
    entryId: string,
    preset: "tomorrow" | "3days" | "7days" | number
  ): Promise<EntryReviewState> {
    const timestamp = now()
    const dueAt = new Date(timestamp)

    // Calculate new due date based on preset
    switch (preset) {
      case "tomorrow": {
        dueAt.setDate(dueAt.getDate() + 1)
        break
      }
      case "3days": {
        dueAt.setDate(dueAt.getDate() + 3)
        break
      }
      case "7days": {
        dueAt.setDate(dueAt.getDate() + 7)
        break
      }
      default: {
        if (typeof preset === "number") {
          dueAt.setDate(dueAt.getDate() + preset)
        }
      }
    }

    // Check if state exists
    const currentState = await localDb
      .select()
      .from(entryReviewState)
      .where(eq(entryReviewState.entryId, entryId))
      .limit(1)

    if (currentState.length > 0) {
      await localDb
        .update(entryReviewState)
        .set({
          dueAt,
          updatedAt: timestamp,
          syncStatus: "pending"
        })
        .where(eq(entryReviewState.entryId, entryId))
    } else {
      const newState: NewEntryReviewState = {
        entryId,
        userId,
        dueAt,
        intervalDays: 0,
        ease: SM2_DEFAULTS.initialEase,
        reps: 0,
        lapses: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: "pending"
      }
      await localDb.insert(entryReviewState).values(newState)
    }

    const result = await localDb
      .select()
      .from(entryReviewState)
      .where(eq(entryReviewState.entryId, entryId))
      .limit(1)

    const updatedState = result[0]
    if (!updatedState) {
      throw new Error("Failed to get updated review state")
    }
    return updatedState
  }

  /**
   * Get today's review stats
   */
  async getTodayStats(userId: string, _tzOffset = 0): Promise<TodayStats> {
    // setHours() already works in the device's local time zone, so local
    // midnight is the day boundary. Adding the offset again (it is the device
    // offset, e.g. +480 in UTC+8) would shift "today" to 08:00–08:00.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    // Count reviewed today
    const reviewedResult = await localDb
      .select({ count: count() })
      .from(reviewEvents)
      .where(
        and(
          eq(reviewEvents.userId, userId),
          gte(reviewEvents.reviewedAt, todayStart),
          lt(reviewEvents.reviewedAt, todayEnd)
        )
      )

    // Count total entries
    const totalResult = await localDb
      .select({ count: count() })
      .from(entries)
      .where(and(eq(entries.userId, userId), sql`${entries.deletedAt} IS NULL`))

    // Count starred entries
    const starredResult = await localDb
      .select({ count: count() })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          sql`${entries.deletedAt} IS NULL`,
          eq(entries.isStarred, true)
        )
      )

    // Count unreviewed entries (entries that have never been reviewed)
    const unreviewedResult = await localDb
      .select({ count: count() })
      .from(entries)
      .leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
      .where(
        and(
          eq(entries.userId, userId),
          sql`${entries.deletedAt} IS NULL`,
          sql`${entryReviewState.entryId} IS NULL`
        )
      )

    // Calculate streak (consecutive days with at least one review)
    const streak = await this.calculateStreak(userId)

    return {
      reviewedToday: reviewedResult[0]?.count ?? 0,
      totalEntries: totalResult[0]?.count ?? 0,
      starredEntries: starredResult[0]?.count ?? 0,
      unreviewedEntries: unreviewedResult[0]?.count ?? 0,
      streak
    }
  }

  /**
   * Get due stats
   */
  async getDueStats(userId: string, _tzOffset = 0): Promise<DueStats> {
    // Local midnight is the day boundary; see getTodayStats.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const tomorrowEnd = new Date(todayEnd)
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

    // Count overdue (dueAt < today start)
    const overdueResult = await localDb
      .select({ count: count() })
      .from(entryReviewState)
      .where(
        and(
          eq(entryReviewState.userId, userId),
          lt(entryReviewState.dueAt, todayStart)
        )
      )

    // Count due today (todayStart <= dueAt < todayEnd)
    const dueTodayResult = await localDb
      .select({ count: count() })
      .from(entryReviewState)
      .where(
        and(
          eq(entryReviewState.userId, userId),
          gte(entryReviewState.dueAt, todayStart),
          lt(entryReviewState.dueAt, todayEnd)
        )
      )

    // Count due tomorrow (todayEnd <= dueAt < tomorrowEnd)
    const dueTomorrowResult = await localDb
      .select({ count: count() })
      .from(entryReviewState)
      .where(
        and(
          eq(entryReviewState.userId, userId),
          gte(entryReviewState.dueAt, todayEnd),
          lt(entryReviewState.dueAt, tomorrowEnd)
        )
      )

    // Count new entries (without review state)
    const newResult = await localDb
      .select({ count: count() })
      .from(entries)
      .leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
      .where(
        and(
          eq(entries.userId, userId),
          sql`${entries.deletedAt} IS NULL`,
          sql`${entryReviewState.entryId} IS NULL`
        )
      )

    return {
      overdue: overdueResult[0]?.count ?? 0,
      dueToday: dueTodayResult[0]?.count ?? 0,
      upcoming: dueTomorrowResult[0]?.count ?? 0,
      newCount: newResult[0]?.count ?? 0
    }
  }

  /**
   * Calculate review streak
   */
  private async calculateStreak(userId: string): Promise<number> {
    // Get distinct review dates in descending order
    const events = await localDb
      .select({ reviewedAt: reviewEvents.reviewedAt })
      .from(reviewEvents)
      .where(eq(reviewEvents.userId, userId))
      .orderBy(desc(reviewEvents.reviewedAt))
      .limit(100)

    if (events.length === 0) {
      return 0
    }

    // Convert to dates and count consecutive days
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get unique dates
    const uniqueDates = new Set<string>()
    for (const event of events) {
      const date = new Date(event.reviewedAt)
      date.setHours(0, 0, 0, 0)
      const dateStr = date.toISOString().split("T")[0]
      if (dateStr) {
        uniqueDates.add(dateStr)
      }
    }

    const sortedDates = [...uniqueDates].toSorted().toReversed()
    const dateSet = new Set(sortedDates)

    // Check if today or yesterday has a review
    const todayStr = today.toISOString().split("T")[0] ?? ""
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0] ?? ""

    if (
      !(sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr))
    ) {
      return 0
    }

    // Count consecutive days
    let streak = 0
    const checkDate = new Date(
      sortedDates.includes(todayStr) ? today : yesterday
    )

    for (const _ of sortedDates) {
      const checkDateStr = checkDate.toISOString().split("T")[0] ?? ""
      if (dateSet.has(checkDateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  }

  /**
   * Get review history for an entry
   */
  getHistory(entryId: string, limit = 10): Promise<ReviewEvent[]> {
    return localDb
      .select()
      .from(reviewEvents)
      .where(eq(reviewEvents.entryId, entryId))
      .orderBy(desc(reviewEvents.reviewedAt))
      .limit(limit)
  }

  /**
   * Get review state for an entry
   */
  async getState(entryId: string): Promise<EntryReviewState | null> {
    const result = await localDb
      .select()
      .from(entryReviewState)
      .where(eq(entryReviewState.entryId, entryId))
      .limit(1)

    return result[0] ?? null
  }

  /**
   * Get review states pending sync
   */
  getPendingSyncStates(userId: string): Promise<EntryReviewState[]> {
    return localDb
      .select()
      .from(entryReviewState)
      .where(
        and(
          eq(entryReviewState.userId, userId),
          eq(entryReviewState.syncStatus, "pending")
        )
      )
  }

  /**
   * Mark review state as synced
   */
  async markStateSynced(entryId: string): Promise<void> {
    const timestamp = now()
    await localDb
      .update(entryReviewState)
      .set({
        syncStatus: "synced",
        updatedAt: timestamp
      })
      .where(eq(entryReviewState.entryId, entryId))
  }

  /**
   * Get review events pending sync
   */
  getPendingSyncEvents(userId: string): Promise<ReviewEvent[]> {
    return localDb
      .select()
      .from(reviewEvents)
      .where(
        and(
          eq(reviewEvents.userId, userId),
          eq(reviewEvents.syncStatus, "pending")
        )
      )
  }

  /**
   * Mark review event as synced
   */
  async markEventSynced(eventId: string): Promise<void> {
    await localDb
      .update(reviewEvents)
      .set({
        syncStatus: "synced"
      })
      .where(eq(reviewEvents.id, eventId))
  }
}

// Export singleton instance
export const reviewRepository = new ReviewRepository()
