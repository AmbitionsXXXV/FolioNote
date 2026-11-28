/** IANA time zone of the browser, sent so study days follow the user's clock. */
export const getBrowserTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/**
 * A study day ("YYYY-MM-DD") as a Date at UTC noon; format it with
 * `timeZone: "UTC"` so the calendar day never shifts.
 */
export const studyDayToDate = (date: string): Date =>
  new Date(`${date}T12:00:00Z`)

export const shiftMonth = (month: string, delta: number): string => {
  const [year, monthIndex] = month.split("-").map(Number)
  const shifted = new Date(
    Date.UTC(year as number, (monthIndex as number) - 1 + delta, 1)
  )
  return shifted.toISOString().slice(0, 7)
}

/** Alternate tilt so a row of stamps looks hand-pressed. */
export const stampTilt = (date: string): string =>
  Number(date.slice(-2)) % 2 === 0 ? "rotate-6" : "-rotate-8"

export type StudyDayStatus = "active" | "goal_met" | "frozen" | null
