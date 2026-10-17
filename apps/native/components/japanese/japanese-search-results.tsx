import { useRouter } from "expo-router"
import { cn, PressableFeedback, Skeleton } from "heroui-native"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { JapaneseLevelChip } from "./japanese-level-chip"
import { JapaneseSectionTitle } from "./japanese-section-title"

interface WordResult {
  id: string
  word: string
  reading: string
  romaji: string
  level: string
  meaningsEn: string[]
  meaningsZh: string[] | null
}

interface KanjiResult {
  character: string
  level: string
  strokes: number | null
  meaningsEn: string[]
}

interface GrammarResult {
  id: string
  pattern: string
  level: string
  meaning: string
  formation: string
}

export interface JapaneseSearchData {
  words: WordResult[]
  kanji: KanjiResult[]
  grammar: GrammarResult[]
}

interface JapaneseSearchResultsProps {
  query: string
  data: JapaneseSearchData | undefined
  isPending: boolean
}

const ROW_CLASS = "min-h-14 flex-row items-center gap-3 px-3 py-3"

function ResultGroup({
  title,
  children
}: {
  title: string
  children: ReactNode
}) {
  return (
    <View>
      <JapaneseSectionTitle className="mb-1 px-3">{title}</JapaneseSectionTitle>
      {children}
    </View>
  )
}

/** Hairline between rows; the last row has none. */
const rowBorder = (index: number, count: number) =>
  index < count - 1 ? "border-b border-border" : ""

function ResultsSkeleton() {
  return (
    <View className="gap-3 px-3">
      {["a", "b", "c", "d"].map((key) => (
        <View className="flex-row items-center gap-4 py-3" key={key}>
          <Skeleton className="h-7 w-20 rounded-md" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3 w-1/3 rounded-md" />
            <Skeleton className="h-3 w-2/3 rounded-md" />
          </View>
        </View>
      ))}
    </View>
  )
}

export function JapaneseSearchResults({
  query,
  data,
  isPending
}: JapaneseSearchResultsProps) {
  const { t } = useTranslation()
  const router = useRouter()

  if (isPending || !data) {
    return <ResultsSkeleton />
  }

  const isEmpty =
    data.words.length === 0 &&
    data.kanji.length === 0 &&
    data.grammar.length === 0

  if (isEmpty) {
    return (
      <View className="items-center px-3 py-10">
        <Text className="text-center text-base font-medium text-foreground">
          {t("japanese.search.noResults", { query })}
        </Text>
        <Text className="mt-1 text-center text-sm text-muted">
          {t("japanese.search.noResultsHint")}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-6">
      {data.words.length > 0 ? (
        <ResultGroup title={t("japanese.search.resultsWords")}>
          {data.words.map((word, index) => {
            const meaning = word.meaningsZh?.[0] ?? word.meaningsEn[0] ?? ""
            return (
              <PressableFeedback
                accessibilityHint={meaning}
                accessibilityLabel={`${word.word}、${word.reading}、${word.level}`}
                accessibilityRole="button"
                className={cn(
                  "rounded-2xl",
                  rowBorder(index, data.words.length)
                )}
                key={word.id}
                onPress={() => router.push(`/japanese/word/${word.id}`)}
              >
                <PressableFeedback.Highlight />
                <View className={ROW_CLASS}>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-baseline gap-x-2">
                      <Text className="text-xl font-semibold text-foreground">
                        {word.word}
                      </Text>
                      {word.reading !== word.word ? (
                        <Text className="text-sm text-muted">
                          {word.reading}
                        </Text>
                      ) : null}
                      <Text className="text-xs text-muted">{word.romaji}</Text>
                    </View>
                    <Text
                      className="mt-0.5 text-sm text-muted"
                      numberOfLines={1}
                    >
                      {meaning}
                    </Text>
                  </View>
                  <JapaneseLevelChip level={word.level} />
                </View>
              </PressableFeedback>
            )
          })}
        </ResultGroup>
      ) : null}

      {data.kanji.length > 0 ? (
        <ResultGroup title={t("japanese.search.resultsKanji")}>
          {data.kanji.map((kanji, index) => (
            <View
              accessible
              className={cn(ROW_CLASS, rowBorder(index, data.kanji.length))}
              key={kanji.character}
            >
              <Text className="w-12 text-3xl font-semibold text-foreground">
                {kanji.character}
              </Text>
              <View className="min-w-0 flex-1">
                <Text className="text-sm text-foreground">
                  {kanji.meaningsEn.join(", ")}
                </Text>
                {kanji.strokes !== null ? (
                  <Text className="mt-0.5 text-xs text-muted">
                    {t("japanese.search.strokes", { count: kanji.strokes })}
                  </Text>
                ) : null}
              </View>
              <JapaneseLevelChip level={kanji.level} />
            </View>
          ))}
        </ResultGroup>
      ) : null}

      {data.grammar.length > 0 ? (
        <ResultGroup title={t("japanese.search.resultsGrammar")}>
          {data.grammar.map((grammar, index) => (
            <View
              accessible
              className={cn(ROW_CLASS, rowBorder(index, data.grammar.length))}
              key={grammar.id}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-lg font-semibold text-foreground">
                  {grammar.pattern}
                </Text>
                <Text className="mt-0.5 text-sm text-muted">
                  {grammar.meaning}
                </Text>
                <Text className="mt-1 text-xs text-muted">
                  <Text className="font-medium">
                    {t("japanese.search.formation")}:{" "}
                  </Text>
                  {grammar.formation}
                </Text>
              </View>
              <JapaneseLevelChip level={grammar.level} />
            </View>
          ))}
        </ResultGroup>
      ) : null}
    </View>
  )
}
