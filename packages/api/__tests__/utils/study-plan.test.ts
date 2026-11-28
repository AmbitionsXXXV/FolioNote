import { describe, expect, it } from "vite-plus/test"

import {
  MAX_REPLAY_AGE_MS,
  planToday,
  REVIEW_BACKLOG_THRESHOLD,
  replayTime
} from "../../src/utils/study-plan"

const plan = (overrides: Partial<Parameters<typeof planToday>[0]> = {}) =>
  planToday({
    dailyNewWords: 10,
    dailyReviewLimit: null,
    newDone: 0,
    reviewDone: 0,
    dueNow: 0,
    ...overrides
  })

describe("planToday", () => {
  it("offers the full new-word target and uncapped reviews by default", () => {
    expect(plan()).toEqual({
      newTarget: 10,
      newRemaining: 10,
      reviewRemaining: null,
      backlogged: false
    })
  })

  it("counts down new words and never goes below zero", () => {
    expect(plan({ newDone: 3 }).newRemaining).toBe(7)
    expect(plan({ newDone: 15 }).newRemaining).toBe(0)
  })

  it("halves new words while the review backlog is large", () => {
    const backlogged = plan({ dueNow: REVIEW_BACKLOG_THRESHOLD + 1 })
    expect(backlogged.backlogged).toBe(true)
    expect(backlogged.newTarget).toBe(5)
    expect(plan({ dueNow: REVIEW_BACKLOG_THRESHOLD }).newTarget).toBe(10)
    expect(
      plan({ dailyNewWords: 15, dueNow: REVIEW_BACKLOG_THRESHOLD + 1 })
        .newTarget
    ).toBe(8)
  })

  it("applies a review cap when one is set", () => {
    expect(
      plan({ dailyReviewLimit: 100, reviewDone: 40 }).reviewRemaining
    ).toBe(60)
    expect(
      plan({ dailyReviewLimit: 100, reviewDone: 140 }).reviewRemaining
    ).toBe(0)
  })
})

describe("replayTime", () => {
  const now = new Date("2026-11-28T12:00:00Z")

  it("uses now when no time was sent", () => {
    expect(replayTime(undefined, now)).toBe(now)
  })

  it("keeps a recent offline time", () => {
    const at = new Date("2026-11-27T22:00:00Z")
    expect(replayTime(at, now)).toBe(at)
  })

  it("never dates a rating in the future or more than a week back", () => {
    expect(replayTime(new Date("2026-11-29T00:00:00Z"), now)).toBe(now)
    expect(
      replayTime(new Date(now.getTime() - MAX_REPLAY_AGE_MS - 1), now)
    ).toBe(now)
  })
})
