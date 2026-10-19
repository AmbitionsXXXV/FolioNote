import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Delete02Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import {
  Button,
  Card,
  Chip,
  PressableFeedback,
  SearchField,
  Skeleton,
  useThemeColor
} from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ScrollView, Text, View } from "react-native"

import { Container } from "@/components/container"
import { JapaneseAttribution } from "@/components/japanese/japanese-attribution"
import { JapaneseSearchResults } from "@/components/japanese/japanese-search-results"
import { JapaneseSectionTitle } from "@/components/japanese/japanese-section-title"
import { useDebounce } from "@/hooks/use-debounce"
import { useOnDeviceJapanese } from "@/hooks/use-on-device-japanese"
import { removeOnDeviceDictionary } from "@/lib/japanese/on-device-engine"
import { orpc } from "@/utils/orpc"

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_LIMIT = 20
const LEVELS_STALE_MS = 5 * 60 * 1000
const EXAMPLE_QUERIES = ["たべる", "taberu", "食", "てみる", "eat"]
const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"]

interface LevelCount {
  level: string
  words: number
  kanji: number
  grammar: number
}

function LevelRow({
  levels,
  isPending
}: {
  levels: LevelCount[] | undefined
  isPending: boolean
}) {
  const { t } = useTranslation()

  return (
    <View>
      <JapaneseSectionTitle>
        {t("japanese.search.levelsTitle")}
      </JapaneseSectionTitle>
      <View className="mt-3 flex-row gap-2">
        {isPending || !levels
          ? LEVEL_ORDER.map((level) => (
              <Skeleton className="h-20 flex-1 rounded-2xl" key={level} />
            ))
          : levels.map((level) => (
              <View
                accessibilityLabel={`${level.level}: ${t("japanese.search.levelWords", { count: level.words })}, ${t("japanese.search.levelKanji", { count: level.kanji })}, ${t("japanese.search.levelGrammar", { count: level.grammar })}`}
                accessible
                className="flex-1 items-center rounded-2xl border border-border bg-surface px-1 py-3"
                key={level.level}
              >
                <Text className="text-lg font-semibold text-accent">
                  {level.level}
                </Text>
                <Text className="mt-1 text-sm font-medium text-foreground">
                  {level.words}
                </Text>
                <Text className="text-[10px] text-muted">
                  {t("japanese.search.resultsWords")}
                </Text>
              </View>
            ))}
      </View>
      <Text className="mt-2 text-xs leading-4 text-muted">
        {t("japanese.search.levelsNote")}
      </Text>
    </View>
  )
}

function ReadingCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  const accentColor = useThemeColor("accent")
  const mutedColor = useThemeColor("muted")

  return (
    <PressableFeedback
      accessibilityHint={t("japanese.search.readingDescription")}
      accessibilityLabel={t("japanese.search.readingTitle")}
      accessibilityRole="button"
      onPress={onPress}
    >
      <PressableFeedback.Highlight />
      <Card className="p-4" variant="secondary">
        <View className="flex-row items-center">
          <View className="mr-3 size-12 items-center justify-center rounded-lg bg-accent/10">
            <HugeiconsIcon
              color={accentColor}
              icon={BookOpen01Icon}
              size={24}
            />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-foreground">
              {t("japanese.search.readingTitle")}
            </Text>
            <Text className="text-sm text-muted">
              {t("japanese.search.readingDescription")}
            </Text>
          </View>
          <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
        </View>
      </Card>
    </PressableFeedback>
  )
}

const BYTES_PER_MB = 1_000_000

/** Status of the downloaded dictionary for on-device analysis, with removal. */
function DictionaryCard() {
  const { t } = useTranslation()
  const engine = useOnDeviceJapanese()
  const dangerColor = useThemeColor("danger")
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

  return (
    <View>
      <JapaneseSectionTitle>
        {t("japanese.engine.statusTitle")}
      </JapaneseSectionTitle>
      <Card className="mt-3 p-4" variant="secondary">
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-sm leading-5 text-muted">
            {dictionary
              ? t("japanese.engine.statusDownloaded", {
                  size: Math.round(dictionary.bytes / BYTES_PER_MB),
                  version: dictionary.version.slice(0, 6)
                })
              : t("japanese.engine.statusNotDownloaded")}
          </Text>
          {(dictionary || engine.hasCachedFiles) && (
            <Button
              accessibilityLabel={t("japanese.engine.remove")}
              isDisabled={isBusy}
              onPress={() => {
                void removeOnDeviceDictionary()
              }}
              size="sm"
              variant="tertiary"
            >
              <HugeiconsIcon
                color={dangerColor}
                icon={Delete02Icon}
                size={16}
              />
              <Button.Label>{t("japanese.engine.remove")}</Button.Label>
            </Button>
          )}
        </View>
        {devMetrics.length > 0 && (
          <Text className="mt-2 text-[11px] text-muted">{devMetrics}</Text>
        )}
      </Card>
    </View>
  )
}

function HubHome({
  onPickExample
}: {
  onPickExample: (value: string) => void
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const levels = useQuery({
    ...orpc.japanese.levels.queryOptions(),
    staleTime: LEVELS_STALE_MS
  })

  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-muted">
          {t("japanese.search.tryLabel")}
        </Text>
        {EXAMPLE_QUERIES.map((example) => (
          <Chip
            accessibilityLabel={`${t("japanese.search.tryLabel")} ${example}`}
            accessibilityRole="button"
            color="default"
            hitSlop={8}
            key={example}
            onPress={() => onPickExample(example)}
            variant="soft"
          >
            <Chip.Label>{example}</Chip.Label>
          </Chip>
        ))}
      </View>

      <LevelRow isPending={levels.isPending} levels={levels.data} />

      <ReadingCard onPress={() => router.push("/japanese/read")} />

      <DictionaryCard />
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
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 24 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text className="text-sm text-muted">
            {t("japanese.description")}
          </Text>
          <SearchField className="mt-3" onChange={setInput} value={input}>
            <SearchField.Group className="h-12 rounded-2xl">
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
          <HubHome onPickExample={setInput} />
        )}

        <JapaneseAttribution />
      </ScrollView>
    </Container>
  )
}
