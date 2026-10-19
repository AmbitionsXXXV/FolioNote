import type { AnalyzedText, Word } from "@folionote/japanese"
import { useQueries } from "@tanstack/react-query"
import { Button, Chip, cn, Skeleton, Spinner, Tabs } from "heroui-native"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ScrollView, Text, View } from "react-native"

import { Container } from "@/components/container"
import type { JapaneseReadingUnit } from "@/components/japanese/japanese-analyzed-sentence"
import { JapaneseAnalyzedSentenceView } from "@/components/japanese/japanese-analyzed-sentence"
import { JapaneseExternalLink } from "@/components/japanese/japanese-external-link"
import { READING_UNIT_FONT_SIZE } from "@/components/japanese/japanese-reading-unit"
import { JapaneseWordSheet } from "@/components/japanese/japanese-word-sheet"
import { useOnDeviceJapanese } from "@/hooks/use-on-device-japanese"
import {
  ALL_JAPANESE_POS,
  JAPANESE_POS_UNDERLINE_CLASS,
  japanesePosLabelKey
} from "@/lib/japanese-pos"
import type { JapaneseReadingSentence } from "@/lib/japanese-reading-data"
import {
  JAPANESE_READING_WORKS,
  resolveReadingLocale
} from "@/lib/japanese-reading-data"
import {
  analyzeOnDevice,
  DICTIONARY_DOWNLOAD_MB,
  enableOnDeviceEngine,
  getOnDeviceEngineState,
  isOnDeviceAnalyzerReady,
  isServerRecentlyUnavailable,
  markServerUnavailable
} from "@/lib/japanese/on-device-engine"
import type { OnDeviceEngineState } from "@/lib/japanese/on-device-engine"
import { client } from "@/utils/orpc"

const READING_UNITS: JapaneseReadingUnit[] = ["word", "phrase", "morpheme"]

const UNIT_LABEL_KEY: Record<JapaneseReadingUnit, string> = {
  word: "japanese.reading.unitWord",
  phrase: "japanese.reading.unitPhrase",
  morpheme: "japanese.reading.unitMorpheme"
}

interface SelectedWordRef {
  sentenceId: string
  wordIndex: number
}

const isReadingUnit = (value: string): value is JapaneseReadingUnit =>
  READING_UNITS.includes(value as JapaneseReadingUnit)

const isServiceUnavailable = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "SERVICE_UNAVAILABLE"

/** SERVICE_UNAVAILABLE, or no ORPC code at all: the request never got through. */
const isServerUnavailable = (error: unknown) =>
  isServiceUnavailable(error) ||
  !(typeof error === "object" && error !== null && "code" in error)

interface SentenceAnalysis {
  analysis: AnalyzedText
  source: "server" | "device"
}

/**
 * Server first; the phone's own engine when the user opted in and the server
 * is (or was just) unavailable. Both return the same AnalyzedText shape.
 */
async function analyzeSentence(
  text: string,
  consent: boolean
): Promise<SentenceAnalysis> {
  const hasDictionary = getOnDeviceEngineState().dictionary !== null
  const preferDevice =
    consent &&
    hasDictionary &&
    (isOnDeviceAnalyzerReady() || isServerRecentlyUnavailable())
  if (preferDevice) {
    return { analysis: await analyzeOnDevice(text), source: "device" }
  }
  try {
    const analysis = await client.japanese.analyze({ text })
    return { analysis, source: "server" }
  } catch (error) {
    if (!isServerUnavailable(error)) throw error
    markServerUnavailable()
    if (consent && hasDictionary) {
      return { analysis: await analyzeOnDevice(text), source: "device" }
    }
    throw error
  }
}

function TogglePill({
  isPressed,
  label,
  onToggle
}: {
  isPressed: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <Chip
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: isPressed }}
      color={isPressed ? "accent" : "default"}
      hitSlop={8}
      onPress={onToggle}
      variant={isPressed ? "soft" : "tertiary"}
    >
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  )
}

function PosLegend() {
  const { t } = useTranslation()
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1">
      {ALL_JAPANESE_POS.map((pos) => (
        <View accessible className="flex-row items-center gap-1.5" key={pos}>
          <View
            className={cn(
              "size-2 rounded-sm",
              JAPANESE_POS_UNDERLINE_CLASS[pos]
            )}
          />
          <Text className="text-[11px] text-muted">
            {t(japanesePosLabelKey(pos))}
          </Text>
        </View>
      ))}
    </View>
  )
}

function SentenceSkeleton() {
  return (
    <View className="gap-3 py-2">
      <View className="flex-row flex-wrap gap-2">
        <Skeleton className="h-10 w-16 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-14 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </View>
      <Skeleton className="h-4 w-2/3 rounded-md" />
    </View>
  )
}

function SentenceError({
  error,
  onRetry
}: {
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const message = isServiceUnavailable(error)
    ? t("japanese.reading.engineStarting")
    : t("japanese.reading.analyzeFailed")

  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3"
    >
      <Text className="flex-1 text-sm text-muted">{message}</Text>
      <Button onPress={onRetry} size="sm" variant="tertiary">
        <Button.Label>{t("japanese.reading.retry")}</Button.Label>
      </Button>
    </View>
  )
}

function EngineProgressBar({ fraction }: { fraction: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20"
    >
      <View
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </View>
  )
}

/**
 * Offers the on-device engine when the server can't analyze, then shows the
 * one-time download / start progress.
 */
function OnDeviceEngineBanner({
  engine,
  onEnable,
  serverUnavailable
}: {
  engine: OnDeviceEngineState
  onEnable: () => void
  serverUnavailable: boolean
}) {
  const { t } = useTranslation()
  const { progress, status } = engine

  if (
    status === "downloading" ||
    status === "verifying" ||
    status === "building"
  ) {
    const fraction =
      progress && progress.totalBytes > 0
        ? progress.bytes / progress.totalBytes
        : 0
    const label =
      status === "downloading"
        ? t("japanese.engine.downloading", {
            percent: Math.round(fraction * 100)
          })
        : t(`japanese.engine.${status}`)
    return (
      <View
        accessibilityLiveRegion="polite"
        className="gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
      >
        <View className="flex-row items-center gap-3">
          <Spinner size="sm" />
          <Text className="flex-1 text-sm text-foreground">{label}</Text>
        </View>
        {status === "downloading" && <EngineProgressBar fraction={fraction} />}
      </View>
    )
  }

  if (status === "error") {
    return (
      <View
        accessibilityLiveRegion="polite"
        className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/40 px-4 py-3"
      >
        <View className="flex-1 gap-1">
          <Text className="text-sm text-foreground">
            {t("japanese.engine.failed")}
          </Text>
          {engine.error && (
            <Text className="text-xs text-muted">{engine.error}</Text>
          )}
        </View>
        <Button onPress={onEnable} size="sm" variant="tertiary">
          <Button.Label>{t("japanese.engine.retry")}</Button.Label>
        </Button>
      </View>
    )
  }

  if (serverUnavailable && !isOnDeviceAnalyzerReady()) {
    return (
      <View className="gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-4 py-3">
        <Text className="font-medium text-foreground">
          {t("japanese.engine.offerTitle")}
        </Text>
        <Text className="text-sm leading-5 text-muted">
          {t("japanese.engine.offerDescription", {
            size: DICTIONARY_DOWNLOAD_MB
          })}
        </Text>
        <Button onPress={onEnable} size="sm" variant="primary">
          <Button.Label>{t("japanese.engine.offerAction")}</Button.Label>
        </Button>
      </View>
    )
  }
  return null
}

export default function JapaneseReadingScreen() {
  const { i18n, t } = useTranslation()
  const [selectedWorkId, setSelectedWorkId] = useState(
    JAPANESE_READING_WORKS[0]?.id ?? ""
  )
  const [unit, setUnit] = useState<JapaneseReadingUnit>("word")
  const [showFurigana, setShowFurigana] = useState(true)
  const [showRomaji, setShowRomaji] = useState(true)
  const [selected, setSelected] = useState<SelectedWordRef | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const engine = useOnDeviceJapanese()

  const selectedWork =
    JAPANESE_READING_WORKS.find((work) => work.id === selectedWorkId) ??
    JAPANESE_READING_WORKS[0]
  const sentences: JapaneseReadingSentence[] = selectedWork?.sentences ?? []
  const readingLocale = resolveReadingLocale(
    i18n.resolvedLanguage ?? i18n.language
  )

  // One request per sentence keeps offsets simple and lets a single failure
  // retry on its own.
  const analyses = useQueries({
    queries: sentences.map((sentence) => ({
      queryKey: ["japanese", "analyze", "native", sentence.text],
      queryFn: () => analyzeSentence(sentence.text, engine.consent === true),
      staleTime: Number.POSITIVE_INFINITY,
      retry: 1
    }))
  })
  const serverUnavailable = analyses.some(
    (query) => query.isError && isServerUnavailable(query.error)
  )
  const analyzedOnDevice = analyses.some(
    (query) => query.data?.source === "device"
  )

  const handleEnableOnDevice = async () => {
    try {
      await enableOnDeviceEngine()
    } catch {
      // The banner shows engine.error; nothing else to do here.
      return
    }
    for (const query of analyses) {
      if (query.isError) void query.refetch()
    }
  }

  const selectedSentenceIndex = selected
    ? sentences.findIndex((sentence) => sentence.id === selected.sentenceId)
    : -1
  const selectedAnalysis =
    selectedSentenceIndex >= 0
      ? analyses[selectedSentenceIndex]?.data?.analysis
      : undefined
  const selectedWord =
    selected && selectedAnalysis
      ? selectedAnalysis.words[selected.wordIndex]
      : undefined

  const handleWorkChange = (workId: string) => {
    setSelectedWorkId(workId)
    setSelected(null)
    setIsSheetOpen(false)
  }

  const handleSelectWord = (sentenceId: string, word: Word) => {
    setSelected({ sentenceId, wordIndex: word.index })
    setIsSheetOpen(true)
  }

  if (!selectedWork) {
    return null
  }

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ScrollView
          accessibilityLabel={t("japanese.reading.workPickerLabel")}
          accessibilityRole="tablist"
          contentContainerStyle={{ gap: 8 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {JAPANESE_READING_WORKS.map((work) => {
            const isActive = work.id === selectedWork.id
            return (
              <Chip
                accessibilityLabel={`${work.title}、${work.author}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                color={isActive ? "accent" : "default"}
                hitSlop={8}
                key={work.id}
                onPress={() => handleWorkChange(work.id)}
                variant={isActive ? "primary" : "soft"}
              >
                <Chip.Label>{work.title}</Chip.Label>
              </Chip>
            )
          })}
        </ScrollView>

        <View className="border-b border-border pb-5">
          <Text className="text-xs text-muted">
            {selectedWork.titleReading}
          </Text>
          <Text
            accessibilityRole="header"
            className="text-2xl font-semibold text-foreground"
          >
            {selectedWork.title}
          </Text>
          <Text className="mt-1 text-sm text-muted">
            {selectedWork.author} · {selectedWork.firstPublishedYear}
          </Text>
          <Text className="mt-3 text-sm leading-5 text-muted">
            {selectedWork.descriptions[readingLocale]}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
            <Text className="text-xs text-muted">
              {t("japanese.reading.excerptCount", {
                count: selectedWork.sentences.length
              })}
            </Text>
            <Text className="text-xs text-muted">·</Text>
            <Text className="text-xs text-muted">
              {t("japanese.reading.publicDomain")}
            </Text>
            <Text className="text-xs text-muted">·</Text>
            <JapaneseExternalLink
              label={t("japanese.reading.openOriginal", {
                source: selectedWork.sourceName
              })}
              url={selectedWork.sourceUrl}
            />
          </View>
        </View>

        <View className="gap-3">
          <Tabs
            accessibilityLabel={t("japanese.reading.unitLabel")}
            onValueChange={(value) => {
              if (isReadingUnit(value)) {
                setUnit(value)
              }
            }}
            value={unit}
          >
            <Tabs.List>
              <Tabs.Indicator />
              {READING_UNITS.map((candidate) => (
                <Tabs.Trigger
                  className="flex-1"
                  key={candidate}
                  value={candidate}
                >
                  <Tabs.Label>{t(UNIT_LABEL_KEY[candidate])}</Tabs.Label>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>
          <View className="flex-row items-center gap-2">
            <TogglePill
              isPressed={showFurigana}
              label={t("japanese.reading.furigana")}
              onToggle={() => setShowFurigana((value) => !value)}
            />
            <TogglePill
              isPressed={showRomaji}
              label={t("japanese.reading.romaji")}
              onToggle={() => setShowRomaji((value) => !value)}
            />
            {analyzedOnDevice && (
              <Chip color="success" size="sm" variant="soft">
                <Chip.Label>{t("japanese.engine.onDeviceBadge")}</Chip.Label>
              </Chip>
            )}
          </View>
          <PosLegend />
        </View>

        <OnDeviceEngineBanner
          engine={engine}
          onEnable={() => {
            void handleEnableOnDevice()
          }}
          serverUnavailable={serverUnavailable}
        />

        <View>
          {sentences.map((sentence, index) => {
            const query = analyses[index]
            let body: ReactNode
            if (!query || query.isPending) {
              body = <SentenceSkeleton />
            } else if (query.isError) {
              // Keep the text readable even when segmentation is unavailable.
              body = (
                <View className="gap-3">
                  <Text
                    className="text-foreground"
                    style={{
                      fontSize: READING_UNIT_FONT_SIZE,
                      lineHeight: READING_UNIT_FONT_SIZE * 1.6
                    }}
                  >
                    {sentence.text}
                  </Text>
                  <SentenceError
                    error={query.error}
                    onRetry={() => {
                      query.refetch()
                    }}
                  />
                </View>
              )
            } else {
              body = (
                <JapaneseAnalyzedSentenceView
                  analysis={query.data.analysis}
                  onSelectWord={(word) => handleSelectWord(sentence.id, word)}
                  selectedWordIndex={
                    selected?.sentenceId === sentence.id
                      ? selected.wordIndex
                      : null
                  }
                  showFurigana={showFurigana}
                  showRomaji={showRomaji}
                  unit={unit}
                />
              )
            }
            return (
              <View
                className={cn(
                  "py-4",
                  index < sentences.length - 1 && "border-b border-border"
                )}
                key={sentence.id}
              >
                {body}
                <Text className="mt-4 text-sm leading-5 text-muted">
                  <Text className="opacity-60">
                    {t("japanese.reading.translationLabel")}：
                  </Text>
                  {sentence.translations[readingLocale]}
                </Text>
              </View>
            )
          })}
        </View>

        <Text className="text-center text-xs text-muted">
          {t("japanese.reading.selectHint")}
        </Text>
      </ScrollView>

      <JapaneseWordSheet
        analysis={selectedAnalysis ?? null}
        isOpen={isSheetOpen && selectedWord !== undefined}
        onOpenChange={setIsSheetOpen}
        word={selectedWord ?? null}
      />
    </Container>
  )
}
