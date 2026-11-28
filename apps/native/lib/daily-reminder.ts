import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as Notifications from "expo-notifications"
import * as SecureStore from "expo-secure-store"

/**
 * The daily study reminder: one repeating local notification on this device.
 * Times are "HH:mm" in the device's own clock, matching streak.remindAt.
 */

export const DEFAULT_REMINDER_TIME = "21:00"
export const REMINDER_TIME_OPTIONS = [
  "08:00",
  "12:30",
  "19:00",
  "20:00",
  "21:00",
  "22:00"
] as const

const REMINDER_ID_KEY = "folio_daily_reminder_id"
const REMINDER_TIME_KEY = "folio_daily_reminder_time"
const reminderQueryKey = ["device-prefs", "daily-reminder"] as const

export interface ReminderCopy {
  title: string
  body: string
}

const parseTime = (time: string) => {
  const [hour = 21, minute = 0] = time.split(":").map(Number)
  return { hour, minute }
}

async function cancelScheduled() {
  const previousId = await SecureStore.getItemAsync(REMINDER_ID_KEY)
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId)
    await SecureStore.deleteItemAsync(REMINDER_ID_KEY)
  }
}

/** The reminder time when one is scheduled, otherwise null. */
export async function loadReminderTime(): Promise<string | null> {
  const id = await SecureStore.getItemAsync(REMINDER_ID_KEY)
  if (!id) return null
  return (await SecureStore.getItemAsync(REMINDER_TIME_KEY)) ?? null
}

/**
 * Ask for notification permission (only now, when the reader turns the
 * reminder on) and schedule the daily notification. Returns false when the
 * reader declined, so the caller can turn the switch back off.
 */
export async function scheduleDailyReminder(
  time: string,
  copy: ReminderCopy
): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync()
  if (!permission.granted) return false

  await cancelScheduled()
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: copy.title, body: copy.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      ...parseTime(time)
    }
  })
  await SecureStore.setItemAsync(REMINDER_ID_KEY, id)
  await SecureStore.setItemAsync(REMINDER_TIME_KEY, time)
  return true
}

export async function cancelDailyReminder(): Promise<void> {
  await cancelScheduled()
}

export function useReminderTime() {
  return useQuery({
    queryKey: reminderQueryKey,
    queryFn: loadReminderTime
  })
}

export function useRefreshReminderTime() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: reminderQueryKey })
}
