import { describe, expect, it } from 'vitest'
import {
	calculateNextReview,
	clamp,
	createDefaultReviewState,
	DEFAULT_REVIEW_STATE,
	getEndOfUserToday,
	getStartOfUserToday,
	getUserNow,
	type Rating,
	type ReviewStateInput,
} from '../../src/utils/spaced-repetition'

describe('spaced-repetition', () => {
	describe('DEFAULT_REVIEW_STATE', () => {
		it('should have correct default values', () => {
			expect(DEFAULT_REVIEW_STATE).toEqual({
				intervalDays: 0,
				ease: 2.5,
				reps: 0,
				lapses: 0,
			})
		})
	})

	describe('createDefaultReviewState', () => {
		it('should create default review state with provided date', () => {
			const testDate = new Date('2024-01-15T10:30:00Z')
			const result = createDefaultReviewState(testDate)

			expect(result).toEqual({
				dueAt: testDate,
				lastReviewedAt: null,
				...DEFAULT_REVIEW_STATE,
			})
		})

		it('should use current date when no date provided', () => {
			const before = new Date()
			const result = createDefaultReviewState()
			const after = new Date()

			expect(result.dueAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
			expect(result.dueAt.getTime()).toBeLessThanOrEqual(after.getTime())
			expect(result.lastReviewedAt).toBeNull()
			expect(result.intervalDays).toBe(0)
			expect(result.ease).toBe(2.5)
			expect(result.reps).toBe(0)
			expect(result.lapses).toBe(0)
		})
	})

	describe('calculateNextReview', () => {
		const baseState: ReviewStateInput = {
			dueAt: new Date('2024-01-15T10:00:00Z'),
			lastReviewedAt: new Date('2024-01-14T10:00:00Z'),
			intervalDays: 1,
			ease: 2.5,
			reps: 0,
			lapses: 0,
		}

		const testNow = new Date('2024-01-15T10:30:00Z')

		describe('rating: again', () => {
			it('should reset interval to 1, decrease ease, and increment lapses', () => {
				const result = calculateNextReview(baseState, 'again', testNow)

				expect(result.intervalDays).toBe(1)
				expect(result.ease).toBe(2.3) // 2.5 - 0.20
				expect(result.lapses).toBe(1) // 0 + 1
				expect(result.reps).toBe(1) // 0 + 1
				expect(result.lastReviewedAt).toBe(testNow)
				expect(result.dueAt).toEqual(
					new Date(testNow.getTime() + 1 * 24 * 60 * 60 * 1000)
				)
			})

			it('should clamp ease to minimum 1.3', () => {
				const lowEaseState = { ...baseState, ease: 1.35 }
				const result = calculateNextReview(lowEaseState, 'again', testNow)

				expect(result.ease).toBe(1.3) // 1.35 - 0.20 = 1.15, clamped to 1.3
			})
		})

		describe('rating: hard', () => {
			it('should multiply interval by 1.2, decrease ease', () => {
				const result = calculateNextReview(baseState, 'hard', testNow)

				expect(result.intervalDays).toBe(1) // Math.round(1 * 1.2) = 1
				expect(result.ease).toBe(2.35) // 2.5 - 0.15
				expect(result.lapses).toBe(0) // unchanged
				expect(result.reps).toBe(1)
				expect(result.dueAt).toEqual(
					new Date(testNow.getTime() + 1 * 24 * 60 * 60 * 1000)
				)
			})

			it('should handle large intervals correctly', () => {
				const largeIntervalState = { ...baseState, intervalDays: 10 }
				const result = calculateNextReview(largeIntervalState, 'hard', testNow)

				expect(result.intervalDays).toBe(12) // Math.round(10 * 1.2)
			})
		})

		describe('rating: good', () => {
			it('should multiply interval by ease factor', () => {
				const result = calculateNextReview(baseState, 'good', testNow)

				expect(result.intervalDays).toBe(3) // Math.round(1 * 2.5)
				expect(result.ease).toBe(2.5) // unchanged
				expect(result.reps).toBe(1)
			})

			it('should use interval 1 for first review (intervalDays <= 0)', () => {
				const firstReviewState = { ...baseState, intervalDays: 0 }
				const result = calculateNextReview(firstReviewState, 'good', testNow)

				expect(result.intervalDays).toBe(1)
			})

			it('should round interval correctly', () => {
				const stateWithFloatEase = { ...baseState, ease: 2.3 }
				const result = calculateNextReview(stateWithFloatEase, 'good', testNow)

				expect(result.intervalDays).toBe(2) // Math.round(1 * 2.3)
			})
		})

		describe('rating: easy', () => {
			it('should multiply interval by ease * 1.3, increase ease', () => {
				const result = calculateNextReview(baseState, 'easy', testNow)

				expect(result.intervalDays).toBe(3) // Math.round(1 * 2.5 * 1.3) = Math.round(3.25) = 3
				expect(result.ease).toBe(2.6) // 2.5 + 0.10
				expect(result.reps).toBe(1)
			})

			it('should use interval 2 for first review (intervalDays <= 0)', () => {
				const firstReviewState = { ...baseState, intervalDays: 0 }
				const result = calculateNextReview(firstReviewState, 'easy', testNow)

				expect(result.intervalDays).toBe(2)
			})

			it('should clamp ease to maximum 3.0', () => {
				const highEaseState = { ...baseState, ease: 2.95 }
				const result = calculateNextReview(highEaseState, 'easy', testNow)

				expect(result.ease).toBe(3.0) // 2.95 + 0.10 = 3.05, clamped to 3.0
			})
		})

		describe('edge cases', () => {
			it('should ensure minimum interval of 1', () => {
				const zeroIntervalState = { ...baseState, intervalDays: 0.1, ease: 0.1 }
				const result = calculateNextReview(zeroIntervalState, 'good', testNow)

				expect(result.intervalDays).toBeGreaterThanOrEqual(1)
			})

			it('should handle negative intervals', () => {
				const negativeIntervalState = { ...baseState, intervalDays: -1 }
				const result = calculateNextReview(negativeIntervalState, 'good', testNow)

				expect(result.intervalDays).toBe(1) // baseInterval = 1
			})

			it('should handle very large intervals', () => {
				const largeIntervalState = { ...baseState, intervalDays: 1000 }
				const result = calculateNextReview(largeIntervalState, 'good', testNow)

				expect(result.intervalDays).toBe(2500) // Math.round(1000 * 2.5)
			})
		})

		describe('reps and lapses tracking', () => {
			it('should increment reps for all ratings', () => {
				const ratings: Rating[] = ['again', 'hard', 'good', 'easy']
				for (const rating of ratings) {
					const result = calculateNextReview(baseState, rating, testNow)
					expect(result.reps).toBe(1)
				}
			})

			it('should only increment lapses for "again" rating', () => {
				const ratings: Rating[] = ['hard', 'good', 'easy']
				for (const rating of ratings) {
					const result = calculateNextReview(baseState, rating, testNow)
					expect(result.lapses).toBe(0)
				}
			})

			it('should increment lapses for "again" rating', () => {
				const result = calculateNextReview(baseState, 'again', testNow)
				expect(result.lapses).toBe(1)
			})
		})

		describe('due date calculation', () => {
			it('should calculate due date correctly', () => {
				const result = calculateNextReview(baseState, 'good', testNow)
				const expectedDueAt = new Date(testNow.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days

				expect(result.dueAt).toEqual(expectedDueAt)
			})

			it('should use provided now parameter', () => {
				const customNow = new Date('2024-06-15T12:00:00Z')
				const result = calculateNextReview(baseState, 'good', customNow)
				const expectedDueAt = new Date(customNow.getTime() + 3 * 24 * 60 * 60 * 1000)

				expect(result.dueAt).toEqual(expectedDueAt)
			})
		})
	})

	describe('timezone utilities', () => {
		describe('getStartOfUserToday', () => {
			it('should return a Date object', () => {
				const result = getStartOfUserToday(0)
				expect(result).toBeInstanceOf(Date)
			})

			it('should handle different timezone offsets', () => {
				const utcResult = getStartOfUserToday(0)
				const eastResult = getStartOfUserToday(480) // UTC+8
				const westResult = getStartOfUserToday(-300) // UTC-5

				expect(utcResult).toBeInstanceOf(Date)
				expect(eastResult).toBeInstanceOf(Date)
				expect(westResult).toBeInstanceOf(Date)

				// Different offsets should produce different results
				expect(utcResult.getTime()).not.toBe(eastResult.getTime())
				expect(utcResult.getTime()).not.toBe(westResult.getTime())
			})
		})

		describe('getEndOfUserToday', () => {
			it('should return end of day in user timezone', () => {
				const tzOffset = 0 // UTC
				const result = getEndOfUserToday(tzOffset)
				const startOfToday = getStartOfUserToday(tzOffset)

				// Should be start of today + 24 hours - 1 millisecond
				const expectedEnd = new Date(
					startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1
				)
				expect(result).toEqual(expectedEnd)
			})
		})

		describe('getUserNow', () => {
			it('should return current date', () => {
				const before = new Date()
				const result = getUserNow(480) // any tzOffset
				const after = new Date()

				expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime())
				expect(result.getTime()).toBeLessThanOrEqual(after.getTime())
			})
		})
	})

	describe('clamp function', () => {
		it('should clamp value within range', () => {
			expect(clamp(5, 0, 10)).toBe(5)
			expect(clamp(-5, 0, 10)).toBe(0)
			expect(clamp(15, 0, 10)).toBe(10)
		})
	})
})
