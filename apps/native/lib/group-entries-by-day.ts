export interface DatedEntry {
  id: string
  createdAt: Date | string | number
}

export interface DayGroup<T extends DatedEntry> {
  /** Local calendar day, YYYY-MM-DD; stable key for the section. */
  dayKey: string
  /** Whole days before `now`'s local day (0 = today, 1 = yesterday). */
  daysAgo: number
  /** The group's local midnight, for labelling older days. */
  date: Date
  entries: T[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Splits entries into local calendar days, keeping the incoming order
 * (newest first) inside each day and across days. Entries with an
 * unparsable date are dropped rather than grouped under a bogus day.
 */
export function groupEntriesByDay<T extends DatedEntry>(
  entries: T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const today = startOfLocalDay(now)
  const groups = new Map<string, DayGroup<T>>()

  for (const entry of entries) {
    const created = new Date(entry.createdAt)
    if (Number.isNaN(created.getTime())) {
      continue
    }
    const day = startOfLocalDay(created)
    const dayKey = toDayKey(day)
    let group = groups.get(dayKey)
    if (!group) {
      // Round: DST days are 23 or 25 hours long.
      const daysAgo = Math.round((today.getTime() - day.getTime()) / MS_PER_DAY)
      group = { dayKey, daysAgo, date: day, entries: [] }
      groups.set(dayKey, group)
    }
    group.entries.push(entry)
  }

  return [...groups.values()]
}
