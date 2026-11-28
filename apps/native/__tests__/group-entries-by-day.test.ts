import { expect, it } from "vite-plus/test"

import { groupEntriesByDay } from "../lib/group-entries-by-day"

const NOW = new Date(2026, 10, 28, 10, 0)

it("groups entries into today, yesterday and older local days", () => {
  const groups = groupEntriesByDay(
    [
      { id: "a", createdAt: new Date(2026, 10, 28, 9, 30) },
      { id: "b", createdAt: new Date(2026, 10, 28, 0, 5) },
      { id: "c", createdAt: new Date(2026, 10, 27, 23, 59) },
      { id: "d", createdAt: new Date(2026, 10, 20, 12, 0) }
    ],
    NOW
  )

  expect(groups.map((g) => [g.daysAgo, g.entries.map((e) => e.id)])).toEqual([
    [0, ["a", "b"]],
    [1, ["c"]],
    [8, ["d"]]
  ])
  expect(groups[2]?.dayKey).toBe("2026-11-20")
})

it("accepts ISO strings and drops unparsable dates", () => {
  const groups = groupEntriesByDay(
    [
      { id: "a", createdAt: new Date(2026, 10, 28, 8).toISOString() },
      { id: "bad", createdAt: "not a date" }
    ],
    NOW
  )

  expect(groups).toHaveLength(1)
  expect(groups[0]?.entries.map((e) => e.id)).toEqual(["a"])
})

it("groups by last edit and sorts days and rows newest first", () => {
  const groups = groupEntriesByDay(
    [
      // API order is not by edit time; the headings must still read
      // today, then older days, matching the date each row shows.
      {
        id: "old-edited-today",
        createdAt: new Date(2026, 10, 20, 9),
        updatedAt: new Date(2026, 10, 28, 9)
      },
      { id: "two-days", createdAt: new Date(2026, 10, 26, 9) },
      {
        id: "yesterday",
        createdAt: new Date(2026, 10, 27, 9),
        updatedAt: null
      },
      {
        id: "latest",
        createdAt: new Date(2026, 10, 28, 7),
        updatedAt: new Date(2026, 10, 28, 9, 30)
      }
    ],
    NOW
  )

  expect(groups.map((g) => [g.daysAgo, g.entries.map((e) => e.id)])).toEqual([
    [0, ["latest", "old-edited-today"]],
    [1, ["yesterday"]],
    [2, ["two-days"]]
  ])
})
