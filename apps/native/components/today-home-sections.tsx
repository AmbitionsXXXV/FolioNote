import { CloudIcon, NoteIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { Button } from "heroui-native"
import type { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, View } from "react-native"

import { EntryRow } from "@/components/entry-row"
import {
  GroupedCard,
  GroupedSection,
  RowSeparator
} from "@/components/grouped-list"

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
  t: TranslateFn
}

/**
 * Recent entries as rows in one grouped card.
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
      <GroupedCard className="items-center p-6">
        <HugeiconsIcon color={mutedColor} icon={NoteIcon} size={40} />
        <Text className="mt-3 text-center text-muted">
          {t("activity.noRecentEntries")}
        </Text>
        <Text className="mt-1 text-center text-sm text-muted">
          {t("activity.startCapturing")}
        </Text>
      </GroupedCard>
    )
  }

  return (
    <GroupedCard>
      {entries.map((entry, index) => (
        <View key={entry.id}>
          {index > 0 && <RowSeparator inset={16} />}
          <EntryRow entry={entry} />
        </View>
      ))}
    </GroupedCard>
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
    <GroupedCard className="p-4">
      <View className="flex-row items-center">
        <View className="mr-3 size-10 items-center justify-center rounded-full bg-accent/15">
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
        <Button onPress={onSignIn} size="sm">
          <Button.Label>{t("auth.signIn")}</Button.Label>
        </Button>
      </View>
    </GroupedCard>
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
    <GroupedSection
      actionLabel={t("activity.viewAll")}
      onAction={onViewAll}
      title={t("activity.recentEntries")}
    >
      <RecentEntriesContent
        accentColor={accentColor}
        entries={entries}
        isLoading={isLoading}
        mutedColor={mutedColor}
        t={t}
      />
    </GroupedSection>
  )
}
