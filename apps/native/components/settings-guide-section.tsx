import {
  BookOpen01Icon,
  Clock01Icon,
  Notification01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { router } from "expo-router"
import { useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActionSheetIOS, Alert, Switch, View } from "react-native"
import { useCSSVariable } from "uniwind"

import {
  GroupedCard,
  GroupedRow,
  GroupedSection,
  RowSeparator
} from "@/components/grouped-list"
import { authClient } from "@/lib/auth-client"
import {
  cancelDailyReminder,
  DEFAULT_REMINDER_TIME,
  REMINDER_TIME_OPTIONS,
  scheduleDailyReminder,
  useRefreshReminderTime,
  useReminderTime
} from "@/lib/daily-reminder"
import { haptics } from "@/lib/haptics"
import { getDeviceTimeZone } from "@/lib/study-day"
import { client } from "@/utils/orpc"

/**
 * Settings › 提醒与引导: the daily reminder (a local notification, mirrored
 * to the account's streak settings when signed in) and the onboarding
 * walk-through again.
 */
export function SettingsGuideSection() {
  const { t } = useTranslation()
  const accent = useThemeColor("accent")
  const divider = String(useCSSVariable("--color-divider") ?? "gray")
  const { data: session } = authClient.useSession()
  const reminder = useReminderTime()
  const refresh = useRefreshReminderTime()
  const [isBusy, setIsBusy] = useState(false)
  const time = reminder.data ?? null
  const isOn = time !== null

  const syncToAccount = (remindAt: string | null) => {
    if (!session?.user) return
    client.streak
      .updateSettings({ remindAt, timeZone: getDeviceTimeZone() })
      .catch((error: unknown) => {
        // The device reminder still works; the account copy catches up later.
        console.warn("[Settings] Saving the reminder time failed:", error)
      })
  }

  const schedule = async (at: string) => {
    setIsBusy(true)
    try {
      const granted = await scheduleDailyReminder(at, {
        title: t("reminder.title"),
        body: t("reminder.body")
      })
      if (!granted) {
        Alert.alert(t("reminder.deniedTitle"), t("reminder.deniedBody"))
        return
      }
      syncToAccount(at)
    } finally {
      await refresh()
      setIsBusy(false)
    }
  }

  const toggle = async (next: boolean) => {
    haptics.tap()
    if (next) {
      await schedule(DEFAULT_REMINDER_TIME)
      return
    }
    setIsBusy(true)
    try {
      await cancelDailyReminder()
      syncToAccount(null)
    } finally {
      await refresh()
      setIsBusy(false)
    }
  }

  const pickTime = () => {
    const options = [...REMINDER_TIME_OPTIONS]
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t("reminder.timeTitle"),
        options: [...options, t("common.cancel")],
        cancelButtonIndex: options.length
      },
      (index) => {
        const picked = options[index]
        if (!picked || picked === time) return
        haptics.tap()
        schedule(picked).catch(() => undefined)
      }
    )
  }

  return (
    <View className="mt-4 mb-3">
      <GroupedSection title={t("reminder.section")}>
        <GroupedCard>
          <GroupedRow
            accessory={
              <Switch
                accessibilityLabel={t("reminder.daily")}
                disabled={isBusy || reminder.isPending}
                ios_backgroundColor={divider}
                onValueChange={(value) => {
                  toggle(value).catch(() => undefined)
                }}
                trackColor={{ false: divider, true: accent }}
                value={isOn}
              />
            }
            icon={Notification01Icon}
            label={t("reminder.daily")}
            sublabel={t("reminder.dailyHint")}
          />
          {isOn ? (
            <>
              <RowSeparator />
              <GroupedRow
                icon={Clock01Icon}
                iconTone="neutral"
                label={t("reminder.time")}
                onPress={pickTime}
                value={time}
              />
            </>
          ) : null}
          <RowSeparator />
          <GroupedRow
            icon={BookOpen01Icon}
            iconTone="neutral"
            label={t("reminder.replayOnboarding")}
            onPress={() => router.push("/welcome")}
          />
        </GroupedCard>
      </GroupedSection>
    </View>
  )
}
