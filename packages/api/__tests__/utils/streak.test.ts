import { describe, expect, it } from "vite-plus/test"

import {
  addDays,
  advanceStreak,
  diffDays,
  displayStreak,
  getLocalDate,
  isValidTimeZone,
  isoWeekday,
  nextMilestone,
  seedStreakFromDates
} from "../../src/utils/streak"
import type { StreakSnapshot } from "../../src/utils/streak"

const snapshot = (overrides: Partial<StreakSnapshot> = {}): StreakSnapshot => ({
  currentDays: 0,
  longestDays: 0,
  startedOn: null,
  lastActiveOn: null,
  freezes: 0,
  ...overrides
})

describe("getLocalDate", () => {
  it("rolls the study day over at 4 AM local time", () => {
    // 2026-11-27 01:30 in Shanghai (UTC+8) still belongs to the 26th.
    const lateNight = new Date("2026-11-26T17:30:00Z")
    expect(getLocalDate(lateNight, "Asia/Shanghai", 4)).toBe("2026-11-26")
    // 04:00 starts the 27th.
    const morning = new Date("2026-11-26T20:00:00Z")
    expect(getLocalDate(morning, "Asia/Shanghai", 4)).toBe("2026-11-27")
  })

  it("uses the user's zone, not the server's", () => {
    const instant = new Date("2026-11-27T12:00:00Z")
    expect(getLocalDate(instant, "Asia/Tokyo", 0)).toBe("2026-11-27")
    expect(getLocalDate(instant, "America/Los_Angeles", 4)).toBe("2026-11-27")
    expect(getLocalDate(instant, "Pacific/Kiritimati", 0)).toBe("2026-11-28")
  })

  it("accepts only known zones", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true)
    expect(isValidTimeZone("Mars/Olympus")).toBe(false)
  })
})

describe("date helpers", () => {
  it("adds and diffs days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01")
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31")
    expect(diffDays("2026-11-25", "2026-11-27")).toBe(2)
  })

  it("numbers weekdays Monday first", () => {
    // 2026-11-27 is a Friday.
    expect(isoWeekday("2026-11-27")).toBe(5)
    expect(isoWeekday("2026-11-29")).toBe(7)
  })
})

describe("advanceStreak", () => {
  it("starts a streak on the first ever activity", () => {
    const result = advanceStreak(snapshot(), "2026-11-27")
    expect(result.justCheckedIn).toBe(true)
    expect(result.next).toMatchObject({
      currentDays: 1,
      longestDays: 1,
      startedOn: "2026-11-27",
      lastActiveOn: "2026-11-27"
    })
    expect(result.streakReset).toBe(false)
  })

  it("does nothing for a second activity on the same day", () => {
    const today = snapshot({ currentDays: 4, lastActiveOn: "2026-11-27" })
    const result = advanceStreak(today, "2026-11-27")
    expect(result.justCheckedIn).toBe(false)
    expect(result.next).toBe(today)
  })

  it("ignores activities replayed from an earlier offline day", () => {
    const today = snapshot({ currentDays: 4, lastActiveOn: "2026-11-27" })
    expect(advanceStreak(today, "2026-11-26").justCheckedIn).toBe(false)
  })

  it("extends the streak after yesterday's study", () => {
    const result = advanceStreak(
      snapshot({
        currentDays: 2,
        longestDays: 5,
        startedOn: "2026-11-25",
        lastActiveOn: "2026-11-26"
      }),
      "2026-11-27"
    )
    expect(result.next.currentDays).toBe(3)
    expect(result.next.longestDays).toBe(5)
    expect(result.next.startedOn).toBe("2026-11-25")
    expect(result.newMilestone).toBe(3)
  })

  it("spends freezes on missed days and keeps the streak", () => {
    const result = advanceStreak(
      snapshot({
        currentDays: 10,
        longestDays: 10,
        startedOn: "2026-11-15",
        lastActiveOn: "2026-11-24",
        freezes: 2
      }),
      "2026-11-27"
    )
    expect(result.frozenDates).toEqual(["2026-11-25", "2026-11-26"])
    expect(result.next.freezes).toBe(0)
    expect(result.next.currentDays).toBe(11)
    expect(result.next.startedOn).toBe("2026-11-15")
  })

  it("resets when the gap is longer than the freezes", () => {
    const result = advanceStreak(
      snapshot({
        currentDays: 10,
        longestDays: 12,
        startedOn: "2026-11-14",
        lastActiveOn: "2026-11-23",
        freezes: 2
      }),
      "2026-11-27"
    )
    expect(result.streakReset).toBe(true)
    expect(result.frozenDates).toEqual([])
    expect(result.next).toMatchObject({
      currentDays: 1,
      longestDays: 12,
      startedOn: "2026-11-27",
      freezes: 2
    })
  })

  it("earns a freeze every 7 days, up to 2", () => {
    const earn = advanceStreak(
      snapshot({ currentDays: 6, lastActiveOn: "2026-11-26" }),
      "2026-11-27"
    )
    expect(earn.earnedFreeze).toBe(true)
    expect(earn.next.freezes).toBe(1)
    expect(earn.newMilestone).toBe(7)

    const full = advanceStreak(
      snapshot({ currentDays: 13, lastActiveOn: "2026-11-26", freezes: 2 }),
      "2026-11-27"
    )
    expect(full.earnedFreeze).toBe(false)
    expect(full.next.freezes).toBe(2)
  })
})

describe("displayStreak", () => {
  const alive = snapshot({ currentDays: 12, lastActiveOn: "2026-11-26" })

  it("shows the streak while today is still open", () => {
    expect(displayStreak(alive, "2026-11-26")).toBe(12)
    expect(displayStreak(alive, "2026-11-27")).toBe(12)
  })

  it("keeps a streak that freezes will cover", () => {
    expect(displayStreak({ ...alive, freezes: 1 }, "2026-11-28")).toBe(12)
  })

  it("drops to zero once the streak is lost", () => {
    expect(displayStreak(alive, "2026-11-28")).toBe(0)
    expect(displayStreak(snapshot(), "2026-11-28")).toBe(0)
  })
})

describe("seedStreakFromDates", () => {
  it("counts consecutive days ending yesterday", () => {
    const seeded = seedStreakFromDates(
      ["2026-11-26", "2026-11-25", "2026-11-24", "2026-11-20", "2026-11-27"],
      "2026-11-27"
    )
    expect(seeded).toMatchObject({
      currentDays: 3,
      startedOn: "2026-11-24",
      lastActiveOn: "2026-11-26"
    })
  })

  it("returns an empty streak without recent history", () => {
    expect(seedStreakFromDates(["2026-11-20"], "2026-11-27").currentDays).toBe(
      0
    )
  })
})

describe("nextMilestone", () => {
  it("points at the next goal", () => {
    expect(nextMilestone(0)).toBe(3)
    expect(nextMilestone(12)).toBe(14)
    expect(nextMilestone(365)).toBeNull()
  })
})
