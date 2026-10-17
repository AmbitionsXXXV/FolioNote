import { alignRuby } from "@folionote/japanese"
import { useQuery } from "@tanstack/react-query"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Card, Chip, Skeleton } from "heroui-native"
import { useTranslation } from "react-i18next"
import { ScrollView, Text, View } from "react-native"

import { Container } from "@/components/container"
import { JapaneseAttribution } from "@/components/japanese/japanese-attribution"
import { JapaneseExternalLink } from "@/components/japanese/japanese-external-link"
import { JapaneseLevelChip } from "@/components/japanese/japanese-level-chip"
import { JapaneseRuby } from "@/components/japanese/japanese-ruby"
import { JapaneseSectionTitle } from "@/components/japanese/japanese-section-title"
import { parseFuriganaMarkup } from "@/lib/japanese-furigana"
import { jmdictPosLabelKey } from "@/lib/japanese-jmdict-pos"
import { orpc } from "@/utils/orpc"

const TATOEBA_SENTENCE_URL = "https://tatoeba.org/sentences/show/"
const HEADWORD_FONT_SIZE = 44
const EXAMPLE_FONT_SIZE = 20
const KANJI_FONT_SIZE = 40
const CHINESE_LANGUAGE_PREFIX = "zh"

function PosChips({ codes }: { codes: string[] }) {
  const { t } = useTranslation()
  return (
    <>
      {codes.map((code) => {
        const key = jmdictPosLabelKey(code)
        return (
          <Chip
            accessibilityRole="text"
            color="default"
            key={code}
            size="sm"
            variant="soft"
          >
            <Chip.Label>{key ? t(key) : code}</Chip.Label>
          </Chip>
        )
      })}
    </>
  )
}

function WordSkeleton() {
  return (
    <View className="gap-4">
      <Skeleton className="h-14 w-48 rounded-lg" />
      <Skeleton className="h-4 w-64 rounded-md" />
      <View className="gap-2 pt-4">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </View>
    </View>
  )
}

function ReadingRow({
  label,
  readings
}: {
  label: string
  readings: string[]
}) {
  if (readings.length === 0) {
    return null
  }
  return (
    <View className="flex-row gap-2">
      <Text className="w-10 text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-sm text-foreground">
        {readings.join("、")}
      </Text>
    </View>
  )
}

export default function JapaneseWordScreen() {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isPending, isError } = useQuery({
    ...orpc.japanese.word.queryOptions({ input: { id: id ?? "" } }),
    retry: false
  })

  let body
  if (isPending) {
    body = <WordSkeleton />
  } else if (isError || !data) {
    body = (
      <View className="items-center py-10">
        <Text className="text-2xl font-semibold text-foreground">
          {t("japanese.word.notFound")}
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">
          {t("japanese.word.notFoundHint")}
        </Text>
      </View>
    )
  } else {
    const { word, examples, kanji } = data
    const headword = alignRuby(word.word, word.reading) ?? [{ text: word.word }]
    const wantsChinese = (i18n.resolvedLanguage ?? i18n.language).startsWith(
      CHINESE_LANGUAGE_PREFIX
    )
    const meanings = word.meaningsZh ?? word.meaningsEn
    const showChineseNote = wantsChinese && word.meaningsZh === null

    body = (
      <View className="gap-8">
        <View>
          <JapaneseRuby
            fontSize={HEADWORD_FONT_SIZE}
            segments={headword}
            textClassName="font-semibold"
            wrap
          />
          <View className="mt-2 flex-row flex-wrap items-baseline gap-x-3">
            {word.reading !== word.word ? (
              <Text className="text-base text-muted">{word.reading}</Text>
            ) : null}
            <Text className="text-sm text-muted">{word.romaji}</Text>
          </View>
          <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
            <JapaneseLevelChip approximate level={word.level} />
            <PosChips codes={word.jmdictPos} />
          </View>
        </View>

        <View>
          <JapaneseSectionTitle>
            {t("japanese.word.meanings")}
          </JapaneseSectionTitle>
          {showChineseNote ? (
            <Text className="mt-2 text-xs leading-4 text-muted">
              {t("japanese.word.zhUnavailable")}
            </Text>
          ) : null}
          <View className="mt-3 gap-1.5">
            {meanings.map((meaning, index) => (
              <View accessible className="flex-row gap-3" key={meaning}>
                <Text className="w-5 text-right text-base text-muted">
                  {index + 1}.
                </Text>
                <Text className="flex-1 text-base leading-6 text-foreground">
                  {meaning}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {examples.length > 0 ? (
          <View>
            <JapaneseSectionTitle>
              {t("japanese.word.examples")}
            </JapaneseSectionTitle>
            <View className="mt-1">
              {examples.map((example, index) => (
                <View
                  className={
                    index < examples.length - 1
                      ? "border-b border-border py-4"
                      : "py-4"
                  }
                  key={example.ja}
                >
                  {example.furigana ? (
                    <JapaneseRuby
                      fontSize={EXAMPLE_FONT_SIZE}
                      segments={parseFuriganaMarkup(example.furigana)}
                      wrap
                    />
                  ) : (
                    <Text className="text-xl leading-8 text-foreground">
                      {example.ja}
                    </Text>
                  )}
                  <Text className="mt-1 text-sm leading-5 text-muted">
                    {example.en}
                  </Text>
                  {example.tatoebaId !== null ? (
                    <JapaneseExternalLink
                      className="self-start"
                      label={t("japanese.word.tatoeba")}
                      url={`${TATOEBA_SENTENCE_URL}${example.tatoebaId}`}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {kanji.length > 0 ? (
          <View>
            <JapaneseSectionTitle>
              {t("japanese.word.kanji")}
            </JapaneseSectionTitle>
            <View className="mt-3 gap-3">
              {kanji.map((entry) => (
                <Card className="p-4" key={entry.character} variant="secondary">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text
                      className="font-semibold text-foreground"
                      style={{
                        fontSize: KANJI_FONT_SIZE,
                        lineHeight: KANJI_FONT_SIZE + 8
                      }}
                    >
                      {entry.character}
                    </Text>
                    <JapaneseLevelChip level={entry.level} />
                  </View>
                  <Text className="mt-2 text-sm text-foreground">
                    {entry.meaningsEn.join(", ")}
                  </Text>
                  <View className="mt-3 gap-1">
                    <ReadingRow
                      label={t("japanese.word.onyomi")}
                      readings={entry.onyomi}
                    />
                    <ReadingRow
                      label={t("japanese.word.kunyomi")}
                      readings={entry.kunyomi}
                    />
                  </View>
                  <View className="mt-3 flex-row flex-wrap gap-x-3">
                    {entry.strokes !== null ? (
                      <Text className="text-xs text-muted">
                        {t("japanese.word.strokes", { count: entry.strokes })}
                      </Text>
                    ) : null}
                    {entry.grade !== null ? (
                      <Text className="text-xs text-muted">
                        {t("japanese.word.grade", { grade: entry.grade })}
                      </Text>
                    ) : null}
                  </View>
                  {entry.words.length > 0 ? (
                    <View className="mt-4">
                      <Text className="text-[11px] text-muted">
                        {t("japanese.word.kanjiWords")}
                      </Text>
                      <View className="mt-1.5 flex-row flex-wrap gap-1.5">
                        {entry.words.map((related) => (
                          <Chip
                            accessibilityHint={t("japanese.search.label")}
                            accessibilityLabel={related}
                            accessibilityRole="button"
                            color="default"
                            hitSlop={6}
                            key={related}
                            onPress={() =>
                              router.push({
                                pathname: "/japanese",
                                params: { q: related }
                              })
                            }
                            variant="soft"
                          >
                            <Chip.Label>{related}</Chip.Label>
                          </Chip>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <Stack.Screen options={{ title: data?.word.word ?? "" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {body}
        <JapaneseAttribution />
      </ScrollView>
    </Container>
  )
}
