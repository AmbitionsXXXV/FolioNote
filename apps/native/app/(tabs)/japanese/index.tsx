import {
  BookOpen01Icon,
  CloudIcon,
  NoteEditIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import type { Href } from "expo-router"
import { Button, SearchField, Skeleton } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ScrollView, Text, View } from "react-native"

import { Container } from "@/components/container"
import {
  GroupedCard,
  GroupedRow,
  GroupedSection,
  RowSeparator
} from "@/components/grouped-list"
import { DailyStudyCard } from "@/components/japanese/daily-study-card"
import { JapaneseAttribution } from "@/components/japanese/japanese-attribution"
import { JapaneseSearchResults } from "@/components/japanese/japanese-search-results"
import { useDebounce } from "@/hooks/use-debounce"
import { useOnDeviceJapanese } from "@/hooks/use-on-device-japanese"
import { removeOnDeviceDictionary } from "@/lib/japanese/on-device-engine"
import { orpc } from "@/utils/orpc"

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_LIMIT = 20
const LEVELS_STALE_MS = 5 * 60 * 1000
const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"]
/**
 * The word book list lives in the root stack (app/japanese/books.tsx, added
 * with the daily-vocab work). Widened to string and cast to Href until that route exists;
 * drop both casts once it does.
 */
const WORD_BOOK_PATH = "/japanese/books" as string

interface LevelCount {
  level: string
  words: number
  kanji: number
  grammar: number
}

function LevelGrid({
  levels,
  isPending
}: {
  levels: LevelCount[] | undefined
  isPending: boolean
}) {
  const { t } = useTranslation()

  return (
    <GroupedSection title={t("japanese.search.levelsTitle")}>
      <GroupedCard className="p-3">
        <View className="flex-row gap-1.5">
          {isPending || !levels
            ? LEVEL_ORDER.map((level) => (
                <Skeleton className="h-[68px] flex-1 rounded-xl" key={level} />
              ))
            : levels.map((level) => (
                <View
                  accessibilityLabel={`${level.level}: ${t("japanese.search.levelWords", { count: level.words })}, ${t("japanese.search.levelKanji", { count: level.kanji })}, ${t("japanese.search.levelGrammar", { count: level.grammar })}`}
                  accessible
                  className="flex-1 items-center gap-0.5 rounded-xl bg-default py-2.5"
                  key={level.level}
                >
                  <Text className="text-base font-bold text-accent">
                    {level.level}
                  </Text>
                  <Text className="text-[13px] font-semibold text-foreground tabular-nums">
                    {level.words}
                  </Text>
                  <Text className="text-[10px] text-muted">
                    {t("japanese.search.resultsWords")}
                  </Text>
                </View>
              ))}
        </View>
        <Text className="mt-2.5 text-xs leading-4 text-muted">
          {t("japanese.search.levelsNote")}
        </Text>
      </GroupedCard>
    </GroupedSection>
  )
}

const BYTES_PER_MB = 1_000_000

/** Status of the downloaded dictionary for on-device analysis, with removal. */
function DictionaryRow() {
  const { t } = useTranslation()
  const engine = useOnDeviceJapanese()
  const isBusy =
    engine.status === "downloading" ||
    engine.status === "verifying" ||
    engine.status === "building"
  const { dictionary, metrics } = engine
  const devMetrics = __DEV__
    ? Object.entries(metrics)
        .map(([key, value]) => `${key} ${value}ms`)
        .join(" · ")
    : ""
  const canRemove = Boolean(dictionary || engine.hasCachedFiles)

  return (
    <GroupedCard>
      <GroupedRow
        accessory={
          canRemove ? (
            <Button
              accessibilityLabel={t("japanese.engine.remove")}
              isDisabled={isBusy}
              onPress={() => {
                void removeOnDeviceDictionary()
              }}
              size="sm"
              variant="tertiary"
            >
              <Button.Label className="text-danger">
                {t("japanese.engine.remove")}
              </Button.Label>
            </Button>
          ) : undefined
        }
        icon={CloudIcon}
        iconTone="neutral"
        label={t("japanese.engine.statusTitle")}
        sublabel={
          dictionary
            ? t("japanese.engine.statusDownloaded", {
                size: Math.round(dictionary.bytes / BYTES_PER_MB),
                version: dictionary.version.slice(0, 6)
              })
            : t("japanese.engine.statusNotDownloaded")
        }
      />
      {devMetrics.length > 0 && (
        <Text className="px-4 pb-3 text-[11px] text-muted">{devMetrics}</Text>
      )}
    </GroupedCard>
  )
}

function HubHome() {
  const { t } = useTranslation()
  const router = useRouter()
  const levels = useQuery({
    ...orpc.japanese.levels.queryOptions(),
    staleTime: LEVELS_STALE_MS
  })

  return (
    <View className="gap-4">
      <GroupedCard>
        <GroupedRow
          icon={BookOpen01Icon}
          label={t("japanese.search.readingTitle")}
          onPress={() => router.push("/japanese/read")}
          sublabel={t("japanese.search.readingDescription")}
        />
        <RowSeparator />
        <GroupedRow
          icon={NoteEditIcon}
          label={t("japanese.notebook.title")}
          onPress={() => router.push(WORD_BOOK_PATH as Href)}
          sublabel={t("japanese.notebook.listMeta")}
        />
      </GroupedCard>

      <LevelGrid isPending={levels.isPending} levels={levels.data} />

      <DictionaryRow />
    </View>
  )
}

export default function JapaneseHubScreen() {
  const { t } = useTranslation()
  const { q } = useLocalSearchParams<{ q?: string }>()
  const [input, setInput] = useState(q ?? "")
  const debouncedInput = useDebounce(input, SEARCH_DEBOUNCE_MS)

  const hasInput = input.trim().length > 0
  const trimmedQuery = debouncedInput.trim()
  const search = useQuery({
    ...orpc.japanese.search.queryOptions({
      input: { query: trimmedQuery, limit: SEARCH_LIMIT }
    }),
    enabled: trimmedQuery.length > 0,
    placeholderData: keepPreviousData
  })

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <DailyStudyCard />
        <View>
          <Text className="px-1 text-[13px] text-muted">
            {t("japanese.description")}
          </Text>
          <SearchField className="mt-3" onChange={setInput} value={input}>
            <SearchField.Group className="h-11 rounded-full">
              <SearchField.SearchIcon />
              <SearchField.Input
                accessibilityLabel={t("japanese.search.label")}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("japanese.search.placeholder")}
                returnKeyType="search"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>

        {hasInput ? (
          <JapaneseSearchResults
            data={search.data}
            isPending={search.isPending}
            query={trimmedQuery}
          />
        ) : (
          <HubHome />
        )}

        <JapaneseAttribution />
      </ScrollView>
    </Container>
  )
}
