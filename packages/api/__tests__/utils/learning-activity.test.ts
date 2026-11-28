import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { recordLearningActivity } from "../../src/utils/learning-activity"

// Compile real Drizzle queries against a recording driver; never open a database.
const query = vi.hoisted(() =>
  vi.fn(async (_sql: string, _params: unknown[]) => ({
    rows: [] as unknown[][]
  }))
)
vi.mock("@folionote/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@folionote/db")>()
  const { drizzle } = await import("drizzle-orm/pg-proxy")
  return { ...original, db: drizzle(query) }
})

const { db } = await import("@folionote/db")

afterEach(() => {
  query.mockReset()
  query.mockResolvedValue({ rows: [] })
})

const statements = () => query.mock.calls.map(([statement]) => statement)

describe("recordLearningActivity", () => {
  it("stamps the day and starts a streak on the first activity", async () => {
    query
      // user_streaks: no row yet
      .mockResolvedValueOnce({ rows: [] })
      // review_events history used to seed the streak: none
      .mockResolvedValueOnce({ rows: [] })
      // learning_activities insert
      .mockResolvedValueOnce({ rows: [["act-1"]] })
      // daily_logs upsert returns (points, goal_points)
      .mockResolvedValueOnce({ rows: [[2, 20]] })

    const progress = await recordLearningActivity(db, {
      userId: "owner-a",
      kind: "vocab_new",
      language: "ja",
      occurredAt: new Date("2026-11-27T03:00:00Z"),
      timeZone: "Asia/Tokyo"
    })

    expect(progress).toMatchObject({
      localDate: "2026-11-27",
      pointsEarned: 2,
      todayPoints: 2,
      dailyGoal: 20,
      justCheckedIn: true,
      justMetGoal: false,
      currentDays: 1
    })
    const sqls = statements()
    expect(sqls[2]).toContain('insert into "learning_activities"')
    expect(sqls[3]).toContain('insert into "daily_logs"')
    expect(sqls[3]).toContain('on conflict ("user_id","date") do update')
    expect(sqls[4]).toContain('insert into "user_streaks"')
    // The client's time zone is remembered for later writes.
    expect(query.mock.calls[4]?.[1]).toEqual(
      expect.arrayContaining(["Asia/Tokyo"])
    )
  })

  it("reports the moment the daily goal is reached", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          [
            "owner-a",
            5,
            5,
            "2026-11-22",
            "2026-11-27",
            0,
            "UTC",
            4,
            20,
            null,
            ["ja"],
            new Date(),
            new Date()
          ]
        ]
      })
      .mockResolvedValueOnce({ rows: [["act-2"]] })
      .mockResolvedValueOnce({ rows: [[21, 20]] })

    const progress = await recordLearningActivity(db, {
      userId: "owner-a",
      kind: "vocab_new",
      occurredAt: new Date("2026-11-27T12:00:00Z")
    })

    expect(progress?.justMetGoal).toBe(true)
    // Already checked in today, so the streak does not move.
    expect(progress?.justCheckedIn).toBe(false)
    expect(progress?.currentDays).toBe(5)
  })

  it("skips an activity id that was already recorded", async () => {
    const progress = await recordLearningActivity(db, {
      id: "offline-1",
      userId: "owner-a",
      kind: "entry_review"
    })
    expect(progress).toBeNull()
    expect(statements().some((sql) => sql.includes('"daily_logs"'))).toBe(false)
  })
})
