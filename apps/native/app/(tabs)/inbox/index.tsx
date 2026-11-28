import { formatDate } from "@folionote/locales"
import { Add01Icon, MailOpen01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import {
  Button,
  cn,
  Input,
  Tabs,
  TextField,
  useThemeColor
} from "heroui-native"
import { useEffect, useRef, useState } from "react"
import type { ComponentRef } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native"

import { Container } from "@/components/container"
import { EntryRow } from "@/components/entry-row"
import {
  GroupedCard,
  GroupedSection,
  RowSeparator
} from "@/components/grouped-list"
import { useDataServiceContext } from "@/contexts/data-service-context"
import { groupEntriesByDay } from "@/lib/group-entries-by-day"

interface QuickCaptureProps {
  onCapture: (value: string) => void
  isPending: boolean
  /** Focus the field once, e.g. when opened from the tab bar's capture bar. */
  shouldFocus: boolean
  onFocused: () => void
  /** Leaving the field empty closes it again. */
  onDismiss: () => void
}

function QuickCapture({
  onCapture,
  isPending,
  shouldFocus,
  onFocused,
  onDismiss
}: QuickCaptureProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState("")
  const accentForeground = useThemeColor("accent-foreground")
  const inputRef = useRef<ComponentRef<typeof Input>>(null)

  useEffect(() => {
    if (!shouldFocus) return
    inputRef.current?.focus()
    onFocused()
  }, [shouldFocus, onFocused])

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue) {
      onCapture(trimmedValue)
      setInputValue("")
    }
  }

  const handleBlur = () => {
    if (!inputValue.trim()) {
      onDismiss()
    }
  }

  return (
    <GroupedCard className="p-3">
      <View className="flex-row items-center">
        <TextField className="mr-3 flex-1">
          <Input
            onBlur={handleBlur}
            onChangeText={setInputValue}
            ref={inputRef}
            onSubmitEditing={handleSubmit}
            placeholder={t("entry.quickCapture")}
            returnKeyType="done"
            value={inputValue}
          />
        </TextField>
        <Button
          accessibilityLabel={t("nav.capture")}
          className={cn(
            "size-12 items-center justify-center",
            (!inputValue.trim() || isPending) && "opacity-50"
          )}
          isDisabled={!inputValue.trim() || isPending}
          onPress={handleSubmit}
        >
          {isPending ? (
            <ActivityIndicator color={accentForeground} size="small" />
          ) : (
            <HugeiconsIcon
              color={accentForeground}
              icon={Add01Icon}
              size={24}
            />
          )}
        </Button>
      </View>
    </GroupedCard>
  )
}

const clearCaptureParam = () => router.setParams({ capture: undefined })

type InboxFilter = "all" | "pinned" | "starred"

const INBOX_FILTERS: InboxFilter[] = ["all", "pinned", "starred"]

const FILTER_LABEL_KEY = {
  all: "inbox.filterAll",
  pinned: "inbox.filterPinned",
  starred: "inbox.filterStarred"
} as const

function isInboxFilter(value: string): value is InboxFilter {
  return (INBOX_FILTERS as string[]).includes(value)
}

type InboxEntry = Parameters<typeof EntryRow>[0]["entry"]

function EntryGroup({
  entries,
  title
}: {
  entries: InboxEntry[]
  title: string
}) {
  return (
    <GroupedSection title={title}>
      <GroupedCard>
        {entries.map((entry, index) => (
          <View key={entry.id}>
            {index > 0 && <RowSeparator inset={16} />}
            <EntryRow entry={entry} showPreview />
          </View>
        ))}
      </GroupedCard>
    </GroupedSection>
  )
}

/** "Today" / "Yesterday" in the UI language, else a short date. */
function dayHeading(daysAgo: number, date: Date, locale: string): string {
  if (daysAgo === 0 || daysAgo === 1) {
    const label = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto"
    }).format(-daysAgo, "day")
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return formatDate(date, { locale, preset: "short" })
}

export default function InboxScreen() {
  const { t, i18n } = useTranslation()
  const { dataService, isMigrating } = useDataServiceContext()
  const queryClient = useQueryClient()
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")
  const { capture } = useLocalSearchParams<{ capture?: string }>()
  const [filter, setFilter] = useState<InboxFilter>("all")
  // Capturing lives in the tab bar's accessory; the field only shows up
  // when that accessory opens the inbox, and folds away when left empty.
  const [isCapturing, setIsCapturing] = useState(false)
  const shouldFocusCapture = capture === "1"
  const isCaptureVisible = isCapturing || shouldFocusCapture

  const handleCaptureFocused = () => {
    setIsCapturing(true)
    clearCaptureParam()
  }

  // Fetch inbox entries using DataService
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["entries", "list", "inbox"],
    queryFn: () => dataService?.entries.list({ filter: "inbox", limit: 50 }),
    enabled: !!dataService
  })

  // Create entry mutation using DataService
  const createEntryMutation = useMutation({
    mutationFn: (title: string) => {
      if (!dataService) {
        throw new Error("DataService not available")
      }
      return dataService.entries.create({ title, isInbox: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", "list"] })
    }
  })

  const handleCapture = (text: string) => {
    createEntryMutation.mutate(text)
  }

  // Show loading while migrating or loading data
  if (isMigrating || isLoading || !dataService) {
    return (
      <Container className="flex-1 items-center justify-center" disableTopInset>
        <ActivityIndicator color={accentColor} size="large" />
      </Container>
    )
  }

  const entries = data?.items ?? []
  const pinned = entries.filter((entry) => entry.isPinned)
  const visible = entries.filter((entry) => {
    if (filter === "pinned") {
      return entry.isPinned
    }
    if (filter === "starred") {
      return entry.isStarred
    }
    // "All" lists pinned notes once, in their own section on top.
    return !entry.isPinned
  })
  const dayGroups = groupEntriesByDay(visible)
  const isEmpty = filter === "all" ? entries.length === 0 : visible.length === 0

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              refetch()
            }}
            refreshing={isRefetching}
            tintColor={accentColor}
          />
        }
      >
        {entries.length > 0 && (
          <Text className="px-1 text-[13px] text-muted">
            {t("entry.count", { count: entries.length })}
          </Text>
        )}

        {isCaptureVisible && (
          <QuickCapture
            isPending={createEntryMutation.isPending}
            onCapture={handleCapture}
            onDismiss={() => setIsCapturing(false)}
            onFocused={handleCaptureFocused}
            shouldFocus={shouldFocusCapture}
          />
        )}

        <Tabs
          accessibilityLabel={t("nav.inbox")}
          onValueChange={(value) => {
            if (isInboxFilter(value)) {
              setFilter(value)
            }
          }}
          value={filter}
        >
          <Tabs.List>
            <Tabs.Indicator />
            {INBOX_FILTERS.map((candidate) => (
              <Tabs.Trigger
                className="flex-1"
                key={candidate}
                value={candidate}
              >
                <Tabs.Label>{t(FILTER_LABEL_KEY[candidate])}</Tabs.Label>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>

        {isEmpty ? (
          <View className="items-center justify-center py-20">
            <HugeiconsIcon color={mutedColor} icon={MailOpen01Icon} size={64} />
            <Text className="mt-4 text-center text-lg text-muted">
              {t("entry.emptyInbox")}
            </Text>
            <Text className="mt-2 px-8 text-center text-sm text-muted">
              {t("home.actionDescription.newEntry")}
            </Text>
          </View>
        ) : (
          <>
            {filter === "all" && pinned.length > 0 && (
              <EntryGroup entries={pinned} title={t("entry.pinnedSection")} />
            )}
            {dayGroups.map((group) => (
              <EntryGroup
                entries={group.entries}
                key={group.dayKey}
                title={dayHeading(group.daysAgo, group.date, i18n.language)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </Container>
  )
}
