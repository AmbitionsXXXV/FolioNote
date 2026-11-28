import {
  ArrowRight01Icon,
  CloudIcon,
  NoteIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { Button, Card } from "heroui-native"
import type { useTranslation } from "react-i18next"
import { ActivityIndicator, Pressable, Text, View } from "react-native"

import { EntryCard } from "@/components/entry-card"

type TranslateFn = ReturnType<typeof useTranslation>["t"]

export interface RecentEntry {
  id: string
  title: string | null
  contentText: string | null
  isStarred: boolean | null
  isPinned: boolean | null
  isInbox: boolean | null
  createdAt: Date
  updatedAt: Date
}

interface RecentEntriesContentProps {
  entries: RecentEntry[]
  isLoading: boolean
  accentColor: string
  mutedColor: string
  t: (key: string) => string
}

/**
 * Recent entries content component
 */
function RecentEntriesContent({
  entries,
  isLoading,
  accentColor,
  mutedColor,
  t
}: RecentEntriesContentProps) {
  if (isLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={accentColor} />
      </View>
    )
  }

  if (entries.length === 0) {
    return (
      <Card className="p-6" variant="secondary">
        <View className="items-center">
          <HugeiconsIcon color={mutedColor} icon={NoteIcon} size={48} />
          <Text className="mt-3 text-center text-muted">
            {t("activity.noRecentEntries")}
          </Text>
          <Text className="mt-1 text-center text-sm text-muted">
            {t("activity.startCapturing")}
          </Text>
        </View>
      </Card>
    )
  }

  return (
    <View className="gap-3">
      {entries.map((entry) => (
        <EntryCard entry={entry} key={entry.id} />
      ))}
    </View>
  )
}

interface LocalModeBannerProps {
  accentColor: string
  onSignIn: () => void
  t: TranslateFn
}

/**
 * Banner prompting local-mode users to sign in.
 */
export function LocalModeBanner({
  accentColor,
  onSignIn,
  t
}: LocalModeBannerProps) {
  return (
    <Card
      className="mb-4 border border-accent-soft-hover bg-accent/5 p-4"
      variant="secondary"
    >
      <View className="flex-row items-center">
        <View className="mr-3 size-10 items-center justify-center rounded-full bg-accent/10">
          <HugeiconsIcon color={accentColor} icon={CloudIcon} size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-medium text-foreground">
            {t("onboarding.localModeTitle")}
          </Text>
          <Text className="text-xs text-muted">
            {t("onboarding.localModeHint")}
          </Text>
        </View>
        <Button
          className="bg-accent px-3 py-2 active:opacity-70"
          onPress={onSignIn}
        >
          <Text className="text-xs font-medium text-white">
            {t("auth.signIn")}
          </Text>
        </Button>
      </View>
    </Card>
  )
}

interface RecentEntriesSectionProps {
  entries: RecentEntry[]
  isLoading: boolean
  accentColor: string
  mutedColor: string
  onViewAll: () => void
  t: TranslateFn
}

/**
 * Recent entries section with header and content.
 */
export function RecentEntriesSection({
  entries,
  isLoading,
  accentColor,
  mutedColor,
  onViewAll,
  t
}: RecentEntriesSectionProps) {
  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">
          {t("activity.recentEntries")}
        </Text>
        <Pressable className="flex-row items-center" onPress={onViewAll}>
          <Text className="mr-1 text-sm text-muted">
            {t("activity.viewAll")}
          </Text>
          <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={16} />
        </Pressable>
      </View>

      <RecentEntriesContent
        accentColor={accentColor}
        entries={entries}
        isLoading={isLoading}
        mutedColor={mutedColor}
        t={t}
      />
    </View>
  )
}
