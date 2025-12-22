/**
 * Spaced Repetition Algorithm - Simplified SM-2
 *
 * This module implements a simplified version of the SuperMemo SM-2 algorithm
 * for spaced repetition scheduling.
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export type ReviewState = {
	dueAt: Date
	lastReviewedAt: Date | null
	intervalDays: number
	ease: number
	reps: number
	lapses: number
}

export type ReviewStateInput = {
	dueAt: Date
	lastReviewedAt: Date | null
	intervalDays: number
	ease: number
	reps: number
	lapses: number
}

/**
 * Clamp a number between min and max values
 */
export const clamp = (x: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, x))

/**
 * Default values for a new review state
 */
export const DEFAULT_REVIEW_STATE: Omit<ReviewState, 'dueAt' | 'lastReviewedAt'> = {
	intervalDays: 0,
	ease: 2.5,
	reps: 0,
	lapses: 0,
}

/**
 * Create a default review state for a new entry
 */
export function createDefaultReviewState(now = new Date()): ReviewState {
	return {
		dueAt: now,
		lastReviewedAt: null,
		...DEFAULT_REVIEW_STATE,
	}
}

/**
 * Calculate the next review state based on the current state and rating
 *
 * Algorithm rules:
 * - again: interval = 1, ease -= 0.20, lapses++
 * - hard: interval = baseInterval * 1.2, ease -= 0.15
 * - good: interval = baseInterval * ease (first time = 1)
 * - easy: interval = baseInterval * ease * 1.3 (first time = 2), ease += 0.10
 *
 * Boundary handling:
 * - First review fallback: when intervalDays <= 0, baseInterval = 1
 * - ease clamp: [1.3, 3.0]
 * - interval minimum: >= 1
 * - interval rounding: Math.round()
 */
export function calculateNextReview(
	prev: ReviewStateInput,
	rating: Rating,
	now = new Date()
): ReviewState {
	let ease = prev.ease
	let interval = prev.intervalDays
	const reps = prev.reps + 1
	let lapses = prev.lapses

	// First review fallback: avoid interval = 0 staying at 0 after multiplication
	const baseInterval = interval <= 0 ? 1 : interval

	switch (rating) {
		case 'again':
			lapses += 1
			ease -= 0.2
			interval = 1
			break
		case 'hard':
			ease -= 0.15
			interval = Math.round(baseInterval * 1.2)
			break
		case 'good':
			interval = interval <= 0 ? 1 : Math.round(baseInterval * ease)
			break
		case 'easy':
			ease += 0.1
			interval = interval <= 0 ? 2 : Math.round(baseInterval * ease * 1.3)
			break
		default:
			break
	}

	// Boundary constraints
	ease = clamp(ease, 1.3, 3.0)
	interval = Math.max(1, interval)

	const dueAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000)

	return {
		ease,
		intervalDays: interval,
		reps,
		lapses,
		lastReviewedAt: now,
		dueAt,
	}
}

/**
 * Get the start of today in user's timezone
 */
export function getStartOfUserToday(tzOffset: number): Date {
	const now = new Date()
	// Adjust for timezone offset (tzOffset is in minutes, positive = ahead of UTC)
	const userTime = new Date(now.getTime() + tzOffset * 60 * 1000)
	userTime.setUTCHours(0, 0, 0, 0)
	// Convert back to UTC
	return new Date(userTime.getTime() - tzOffset * 60 * 1000)
}

/**
 * Get the end of today in user's timezone
 */
export function getEndOfUserToday(tzOffset: number): Date {
	const startOfToday = getStartOfUserToday(tzOffset)
	return new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1)
}

/**
 * Get user's current time adjusted for timezone
 */
export function getUserNow(_tzOffset: number): Date {
	// tzOffset is the difference in minutes from UTC
	// For display purposes, we use server time for due comparisons
	return new Date()
}
