/** IANA time zone of the device, sent so study days follow the user's clock. */
export const getDeviceTimeZone = (): string | undefined => {
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
