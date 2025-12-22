import { db, entries, entryReviewState, reviewEvents } from '@folio/db'
import { ORPCError } from '@orpc/server'
import {
	and,
	asc,
	desc,
	eq,
	gte,
	isNull,
	lt,
	lte,
	notInArray,
	sql,
} from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { protectedProcedure } from '../index'
import {
	calculateNextReview,
	createDefaultReviewState,
	getEndOfUserToday,
	getStartOfUserToday,
	type Rating,
} from '../utils/spaced-repetition'

/**
 * Rating schema for review actions
 */
const RatingSchema = z.enum(['again', 'hard', 'good', 'easy']).default('good')

/**
 * Review rule types for queue generation
 */
const ReviewRuleSchema = z
	.enum(['due', 'new', 'starred', 'unreviewed', 'all'])
	.default('due')

/**
 * Input schema for getting review queue
 */
const GetReviewQueueInputSchema = z.object({
	rule: ReviewRuleSchema,
	limit: z.number().int().min(1).max(100).default(50),
	tzOffset: z.number().int().min(-720).max(840).default(0),
})

/**
 * Input schema for marking entry as reviewed
 */
const MarkReviewedInputSchema = z.object({
	entryId: z.string(),
	rating: RatingSchema,
	note: z.string().optional(),
})

/**
 * Input schema for getting review history
 */
const GetReviewHistoryInputSchema = z.object({
	entryId: z.string().optional(),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(20),
})

/**
 * Input schema for getting due stats
 */
const GetDueStatsInputSchema = z.object({
	tzOffset: z.number().int().min(-720).max(840).default(0),
})

/**
 * Snooze preset types
 */
const SnoozePresetSchema = z.enum(['tomorrow', '3days', '7days', 'custom'])

/**
 * Input schema for snoozing an entry
 */
const SnoozeInputSchema = z.object({
	entryId: z.string(),
	preset: SnoozePresetSchema.optional(),
	/** Custom snooze date (ISO string), required when preset is 'custom' */
	untilAt: z.string().datetime().optional(),
	tzOffset: z.number().int().min(-720).max(840).default(0),
})

/**
 * Helper: Get the start of today (midnight) in user timezone
 */
const getStartOfToday = (tzOffset = 0) => getStartOfUserToday(tzOffset)

/**
 * review.getQueue - Get today's review queue based on rule
 */
export const getReviewQueue = protectedProcedure
	.input(GetReviewQueueInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { rule, limit, tzOffset } = input
		const startOfToday = getStartOfToday(tzOffset)
		const now = new Date()

		// Calculate new limit (30% of daily limit, max 20)
		const newLimit = Math.min(20, Math.floor(limit * 0.3))

		// Get entries that have already been reviewed today
		const todayReviews = await db
			.select({ entryId: reviewEvents.entryId })
			.from(reviewEvents)
			.where(
				and(
					eq(reviewEvents.userId, userId),
					gte(reviewEvents.reviewedAt, startOfToday)
				)
			)

		const reviewedTodayIds = todayReviews.map((r) => r.entryId)

		// Build base conditions
		const baseConditions = [eq(entries.userId, userId), isNull(entries.deletedAt)]

		// Exclude already reviewed today entries
		if (reviewedTodayIds.length > 0) {
			baseConditions.push(notInArray(entries.id, reviewedTodayIds))
		}

		let items: (typeof entries.$inferSelect)[] = []

		switch (rule) {
			case 'due': {
				// Get due entries (dueAt <= now)
				const dueItems = await db
					.select({ entry: entries, state: entryReviewState })
					.from(entryReviewState)
					.innerJoin(entries, eq(entryReviewState.entryId, entries.id))
					.where(
						and(
							eq(entryReviewState.userId, userId),
							lte(entryReviewState.dueAt, now),
							isNull(entries.deletedAt),
							reviewedTodayIds.length > 0
								? notInArray(entries.id, reviewedTodayIds)
								: undefined
						)
					)
					.orderBy(asc(entryReviewState.dueAt))
					.limit(limit)

				items = dueItems.map((d) => d.entry)

				// If not enough due items, fill with new entries (no review state)
				if (items.length < limit) {
					const remaining = Math.min(newLimit, limit - items.length)
					const existingEntryIds = items.map((e) => e.id)

					// Get entries without review state (new entries)
					const newItems = await db
						.select({ entry: entries })
						.from(entries)
						.leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
						.where(
							and(
								eq(entries.userId, userId),
								isNull(entries.deletedAt),
								isNull(entryReviewState.entryId),
								reviewedTodayIds.length > 0
									? notInArray(entries.id, reviewedTodayIds)
									: undefined,
								existingEntryIds.length > 0
									? notInArray(entries.id, existingEntryIds)
									: undefined
							)
						)
						.orderBy(desc(entries.createdAt))
						.limit(remaining)

					items = [...items, ...newItems.map((n) => n.entry)]
				}
				break
			}
			case 'new': {
				// Entries created in the last 7 days that haven't been reviewed
				const sevenDaysAgo = new Date()
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

				// Get entries without review state (never reviewed)
				const newItems = await db
					.select({ entry: entries })
					.from(entries)
					.leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
					.where(
						and(
							...baseConditions,
							gte(entries.createdAt, sevenDaysAgo),
							isNull(entryReviewState.entryId)
						)
					)
					.orderBy(desc(entries.createdAt))
					.limit(limit)

				items = newItems.map((n) => n.entry)
				break
			}
			case 'starred': {
				// Starred entries
				items = await db
					.select()
					.from(entries)
					.where(and(...baseConditions, eq(entries.isStarred, true)))
					.orderBy(desc(entries.updatedAt))
					.limit(limit)
				break
			}
			case 'unreviewed': {
				// Entries that have never been reviewed (no review state)
				const unreviewedItems = await db
					.select({ entry: entries })
					.from(entries)
					.leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
					.where(and(...baseConditions, isNull(entryReviewState.entryId)))
					.orderBy(desc(entries.createdAt))
					.limit(limit)

				items = unreviewedItems.map((u) => u.entry)
				break
			}
			default: {
				// All entries (excluding already reviewed today)
				items = await db
					.select()
					.from(entries)
					.where(and(...baseConditions))
					.orderBy(desc(entries.updatedAt))
					.limit(limit)
				break
			}
		}

		return {
			items,
			rule,
			reviewedTodayCount: reviewedTodayIds.length,
		}
	})

/**
 * review.markReviewed - Mark an entry as reviewed with rating
 * Uses transaction to ensure consistency between review_events and entry_review_state
 */
export const markReviewed = protectedProcedure
	.input(MarkReviewedInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { entryId, rating, note } = input
		const now = new Date()

		return await db.transaction(async (tx) => {
			// 1. Verify the entry belongs to the user and is not deleted
			const [entry] = await tx
				.select()
				.from(entries)
				.where(
					and(
						eq(entries.id, entryId),
						eq(entries.userId, userId),
						isNull(entries.deletedAt)
					)
				)
				.limit(1)

			if (!entry) {
				throw new ORPCError('NOT_FOUND', { message: 'Entry not found' })
			}

			// 2. Get or create review state
			const [existingState] = await tx
				.select()
				.from(entryReviewState)
				.where(eq(entryReviewState.entryId, entryId))
				.limit(1)

			const prevState = existingState
				? {
						dueAt: existingState.dueAt,
						lastReviewedAt: existingState.lastReviewedAt,
						intervalDays: existingState.intervalDays,
						ease: existingState.ease,
						reps: existingState.reps,
						lapses: existingState.lapses,
					}
				: createDefaultReviewState(now)

			// 3. Calculate new state
			const newState = calculateNextReview(prevState, rating as Rating, now)

			// 4. Upsert review state
			if (existingState) {
				await tx
					.update(entryReviewState)
					.set({
						dueAt: newState.dueAt,
						lastReviewedAt: newState.lastReviewedAt,
						intervalDays: newState.intervalDays,
						ease: newState.ease,
						reps: newState.reps,
						lapses: newState.lapses,
						updatedAt: now,
					})
					.where(eq(entryReviewState.entryId, entryId))
			} else {
				await tx.insert(entryReviewState).values({
					entryId,
					userId,
					dueAt: newState.dueAt,
					lastReviewedAt: newState.lastReviewedAt,
					intervalDays: newState.intervalDays,
					ease: newState.ease,
					reps: newState.reps,
					lapses: newState.lapses,
					createdAt: now,
					updatedAt: now,
				})
			}

			// 5. Insert review event
			const [reviewEvent] = await tx
				.insert(reviewEvents)
				.values({
					id: nanoid(),
					userId,
					entryId,
					rating,
					note: note ?? null,
					reviewedAt: now,
					scheduledDueAt: newState.dueAt,
				})
				.returning()

			return {
				success: true,
				reviewEvent,
				state: newState,
			}
		})
	})

/**
 * review.getHistory - Get review history
 */
export const getReviewHistory = protectedProcedure
	.input(GetReviewHistoryInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { entryId, cursor, limit } = input

		const conditions = [eq(reviewEvents.userId, userId)]

		if (entryId) {
			conditions.push(eq(reviewEvents.entryId, entryId))
		}

		if (cursor) {
			const [cursorEvent] = await db
				.select({ reviewedAt: reviewEvents.reviewedAt })
				.from(reviewEvents)
				.where(eq(reviewEvents.id, cursor))
				.limit(1)

			if (cursorEvent) {
				conditions.push(lt(reviewEvents.reviewedAt, cursorEvent.reviewedAt))
			}
		}

		const items = await db
			.select({
				reviewEvent: reviewEvents,
				entry: entries,
			})
			.from(reviewEvents)
			.innerJoin(entries, eq(reviewEvents.entryId, entries.id))
			.where(and(...conditions))
			.orderBy(desc(reviewEvents.reviewedAt))
			.limit(limit + 1)

		const hasMore = items.length > limit
		const resultItems = hasMore ? items.slice(0, limit) : items
		const nextCursor = hasMore ? resultItems.at(-1)?.reviewEvent.id : undefined

		return {
			items: resultItems,
			nextCursor,
			hasMore,
		}
	})

/**
 * review.getTodayStats - Get today's review statistics
 */
export const getTodayStats = protectedProcedure
	.input(GetDueStatsInputSchema.optional())
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const tzOffset = input?.tzOffset ?? 0
		const startOfToday = getStartOfToday(tzOffset)

		// Count entries reviewed today
		const todayReviews = await db
			.select({ entryId: reviewEvents.entryId })
			.from(reviewEvents)
			.where(
				and(
					eq(reviewEvents.userId, userId),
					gte(reviewEvents.reviewedAt, startOfToday)
				)
			)

		// Count total entries (not deleted)
		const totalEntries = await db
			.select({ count: sql<number>`count(*)` })
			.from(entries)
			.where(and(eq(entries.userId, userId), isNull(entries.deletedAt)))

		// Count starred entries
		const starredEntries = await db
			.select({ count: sql<number>`count(*)` })
			.from(entries)
			.where(
				and(
					eq(entries.userId, userId),
					eq(entries.isStarred, true),
					isNull(entries.deletedAt)
				)
			)

		// Count entries without review state (never reviewed)
		const unreviewedResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(entries)
			.leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
			.where(
				and(
					eq(entries.userId, userId),
					isNull(entries.deletedAt),
					isNull(entryReviewState.entryId)
				)
			)

		// Calculate streak: consecutive days with at least one review
		const streak = await calculateReviewStreak(userId, tzOffset)

		return {
			reviewedToday: todayReviews.length,
			totalEntries: Number(totalEntries[0]?.count ?? 0),
			starredEntries: Number(starredEntries[0]?.count ?? 0),
			unreviewedEntries: Number(unreviewedResult[0]?.count ?? 0),
			streak,
		}
	})

/**
 * Calculate review streak - consecutive days with at least one review
 * Looks back up to 365 days to find the streak
 */
async function calculateReviewStreak(
	userId: string,
	tzOffset: number
): Promise<number> {
	const startOfToday = getStartOfUserToday(tzOffset)
	const oneYearAgo = new Date(startOfToday.getTime() - 365 * 24 * 60 * 60 * 1000)

	// Get all review events from the past year, grouped by date
	const reviews = await db
		.select({
			reviewedAt: reviewEvents.reviewedAt,
		})
		.from(reviewEvents)
		.where(
			and(eq(reviewEvents.userId, userId), gte(reviewEvents.reviewedAt, oneYearAgo))
		)
		.orderBy(desc(reviewEvents.reviewedAt))

	if (reviews.length === 0) {
		return 0
	}

	// Convert to user timezone dates (YYYY-MM-DD format)
	const reviewDates = new Set<string>()
	for (const review of reviews) {
		const userTime = new Date(review.reviewedAt.getTime() + tzOffset * 60 * 1000)
		const dateStr = userTime.toISOString().split('T')[0] as string
		reviewDates.add(dateStr)
	}

	// Check if today has reviews
	const todayUserTime = new Date(Date.now() + tzOffset * 60 * 1000)
	const todayStr = todayUserTime.toISOString().split('T')[0] as string
	const hasReviewToday = reviewDates.has(todayStr)

	// Start counting from today or yesterday
	let streak = 0
	const currentDate = new Date(startOfToday)

	// If no review today, start from yesterday
	if (!hasReviewToday) {
		currentDate.setTime(currentDate.getTime() - 24 * 60 * 60 * 1000)
	}

	// Count consecutive days
	for (let i = 0; i < 365; i++) {
		const userTime = new Date(currentDate.getTime() + tzOffset * 60 * 1000)
		const dateStr = userTime.toISOString().split('T')[0] as string

		if (reviewDates.has(dateStr)) {
			streak += 1
			currentDate.setTime(currentDate.getTime() - 24 * 60 * 60 * 1000)
		} else {
			break
		}
	}

	return streak
}

/**
 * review.getDueStats - Get due statistics with timezone support
 *
 * Statistics definitions (based on user timezone):
 * - overdue: dueAt < startOfUserToday
 * - dueToday: startOfUserToday <= dueAt <= endOfUserToday
 * - upcoming: endOfUserToday < dueAt <= now + 24h
 * - newCount: entries without entry_review_state
 */
export const getDueStats = protectedProcedure
	.input(GetDueStatsInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { tzOffset } = input
		const now = new Date()
		const startOfToday = getStartOfUserToday(tzOffset)
		const endOfToday = getEndOfUserToday(tzOffset)
		const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

		// Count overdue entries (dueAt < startOfToday)
		const overdueResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(entryReviewState)
			.innerJoin(entries, eq(entryReviewState.entryId, entries.id))
			.where(
				and(
					eq(entryReviewState.userId, userId),
					lt(entryReviewState.dueAt, startOfToday),
					isNull(entries.deletedAt)
				)
			)

		// Count due today entries (startOfToday <= dueAt <= endOfToday)
		const dueTodayResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(entryReviewState)
			.innerJoin(entries, eq(entryReviewState.entryId, entries.id))
			.where(
				and(
					eq(entryReviewState.userId, userId),
					gte(entryReviewState.dueAt, startOfToday),
					lte(entryReviewState.dueAt, endOfToday),
					isNull(entries.deletedAt)
				)
			)

		// Count upcoming entries (endOfToday < dueAt <= now + 24h)
		const upcomingResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(entryReviewState)
			.innerJoin(entries, eq(entryReviewState.entryId, entries.id))
			.where(
				and(
					eq(entryReviewState.userId, userId),
					gte(entryReviewState.dueAt, endOfToday),
					lte(entryReviewState.dueAt, next24h),
					isNull(entries.deletedAt)
				)
			)

		// Count new entries (no review state)
		const newResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(entries)
			.leftJoin(entryReviewState, eq(entries.id, entryReviewState.entryId))
			.where(
				and(
					eq(entries.userId, userId),
					isNull(entries.deletedAt),
					isNull(entryReviewState.entryId)
				)
			)

		return {
			overdue: Number(overdueResult[0]?.count ?? 0),
			dueToday: Number(dueTodayResult[0]?.count ?? 0),
			upcoming: Number(upcomingResult[0]?.count ?? 0),
			newCount: Number(newResult[0]?.count ?? 0),
		}
	})

/**
 * review.getEntryReviewCount - Get review count for an entry
 */
export const getEntryReviewCount = protectedProcedure
	.input(z.object({ entryId: z.string() }))
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id

		// Verify the entry belongs to the user
		const [entry] = await db
			.select()
			.from(entries)
			.where(
				and(
					eq(entries.id, input.entryId),
					eq(entries.userId, userId),
					isNull(entries.deletedAt)
				)
			)
			.limit(1)

		if (!entry) {
			throw new ORPCError('NOT_FOUND', { message: 'Entry not found' })
		}

		// Count reviews for this entry
		const reviews = await db
			.select({ count: sql<number>`count(*)` })
			.from(reviewEvents)
			.where(eq(reviewEvents.entryId, input.entryId))

		// Get last review date
		const lastReview = await db
			.select({ reviewedAt: reviewEvents.reviewedAt })
			.from(reviewEvents)
			.where(eq(reviewEvents.entryId, input.entryId))
			.orderBy(desc(reviewEvents.reviewedAt))
			.limit(1)

		// Get review state
		const [reviewState] = await db
			.select()
			.from(entryReviewState)
			.where(eq(entryReviewState.entryId, input.entryId))
			.limit(1)

		return {
			count: Number(reviews[0]?.count ?? 0),
			lastReviewedAt: lastReview[0]?.reviewedAt ?? null,
			state: reviewState ?? null,
		}
	})

/**
 * review.snooze - Snooze an entry to review later
 * Postpones the entry's dueAt to a future date
 */
export const snooze = protectedProcedure
	.input(SnoozeInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { entryId, preset, untilAt, tzOffset } = input
		const now = new Date()

		// Verify the entry belongs to the user
		const [entry] = await db
			.select()
			.from(entries)
			.where(
				and(
					eq(entries.id, entryId),
					eq(entries.userId, userId),
					isNull(entries.deletedAt)
				)
			)
			.limit(1)

		if (!entry) {
			throw new ORPCError('NOT_FOUND', { message: 'Entry not found' })
		}

		// Calculate the new dueAt based on preset or custom date
		let newDueAt: Date

		if (preset === 'custom' && untilAt) {
			newDueAt = new Date(untilAt)
			if (newDueAt <= now) {
				throw new ORPCError('BAD_REQUEST', {
					message: 'Snooze date must be in the future',
				})
			}
		} else {
			// Calculate based on preset
			const startOfTomorrow = getStartOfUserToday(tzOffset)
			startOfTomorrow.setTime(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000)

			if (preset === '3days') {
				newDueAt = new Date(startOfTomorrow.getTime() + 2 * 24 * 60 * 60 * 1000)
			} else if (preset === '7days') {
				newDueAt = new Date(startOfTomorrow.getTime() + 6 * 24 * 60 * 60 * 1000)
			} else {
				// 'tomorrow' or default
				newDueAt = startOfTomorrow
			}
		}

		// Get or create review state
		const [existingState] = await db
			.select()
			.from(entryReviewState)
			.where(eq(entryReviewState.entryId, entryId))
			.limit(1)

		if (existingState) {
			// Update existing state
			await db
				.update(entryReviewState)
				.set({
					dueAt: newDueAt,
					updatedAt: now,
				})
				.where(eq(entryReviewState.entryId, entryId))
		} else {
			// Create new state with snoozed dueAt
			await db.insert(entryReviewState).values({
				entryId,
				userId,
				dueAt: newDueAt,
				lastReviewedAt: null,
				intervalDays: 0,
				ease: 2.5,
				reps: 0,
				lapses: 0,
				createdAt: now,
				updatedAt: now,
			})
		}

		return {
			success: true,
			entryId,
			newDueAt,
			preset: preset ?? 'tomorrow',
		}
	})

/**
 * Review router - all review-related procedures
 */
export const reviewRouter = {
	getQueue: getReviewQueue,
	markReviewed,
	getHistory: getReviewHistory,
	getTodayStats,
	getDueStats,
	getEntryReviewCount,
	snooze,
}
