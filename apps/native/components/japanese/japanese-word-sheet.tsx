import type { AnalyzedText, Word } from "@folionote/japanese"
import { useRouter } from "expo-router"
import { BottomSheet, Button } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { useBottomSheetOpenState } from "@/hooks/use-bottom-sheet-open-state"
import { japanesePosLabelKey } from "@/lib/japanese-pos"

import { JapaneseNotebookButton } from "./japanese-notebook-button"
import { JapaneseRuby } from "./japanese-ruby"
import { JapaneseSectionTitle } from "./japanese-section-title"
import { JapaneseSpeakButton } from "./japanese-speak-button"

const HEADWORD_FONT_SIZE = 30
const EMPTY = "—"

interface JapaneseWordSheetProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** Stays set while the sheet closes so the content does not vanish mid-animation. */
  word: Word | null
  analysis: AnalyzedText | null
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <View accessible className="mb-3 w-1/2 pr-3">
      <Text className="text-[11px] text-muted">{label}</Text>
      <Text className="text-base font-medium text-foreground">{value}</Text>
    </View>
  )
}

/** Reading, dictionary form, POS and morpheme breakdown of a tapped word. */
export function JapaneseWordSheet({
  isOpen,
  onOpenChange,
  word,
  analysis
}: JapaneseWordSheetProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const sheet = useBottomSheetOpenState(isOpen, onOpenChange)

  const morphemes =
    word && analysis
      ? word.morphemeIndexes
          .map((index) => analysis.morphemes[index])
          .filter((morpheme) => morpheme !== undefined)
      : []

  const handleLookUp = () => {
    if (!word) {
      return
    }
    onOpenChange(false)
    router.push({ pathname: "/japanese", params: { q: word.baseForm } })
  }

  return (
    <BottomSheet {...sheet}>
      <BottomSheet.Content>
        {word ? (
          <View className="px-1 pb-4">
            <View className="flex-row flex-wrap items-end gap-x-3">
              <JapaneseRuby
                fontSize={HEADWORD_FONT_SIZE}
                segments={word.ruby ?? [{ text: word.surface }]}
                textClassName="font-semibold"
              />
              {word.reading ? (
                <Text className="pb-1 text-sm text-muted">{word.reading}</Text>
              ) : null}
              <JapaneseSpeakButton className="pb-1.5" text={word.surface} />
            </View>

            {analysis ? (
              <View className="mt-3 flex-row items-center gap-3">
                <JapaneseNotebookButton
                  className="flex-1"
                  lookupForm={word.baseForm}
                  word={{
                    headword: word.surface,
                    reading: word.reading,
                    baseForm: word.baseForm,
                    pos: t(japanesePosLabelKey(word.pos)),
                    context: { sentence: analysis.text.trim() }
                  }}
                />
                <JapaneseSpeakButton
                  label={t("japanese.speech.playSentence")}
                  text={analysis.text}
                />
              </View>
            ) : null}

            <View className="mt-4 flex-row flex-wrap">
              <DetailField
                label={t("japanese.reading.fieldBaseForm")}
                value={word.baseForm}
              />
              <DetailField
                label={t("japanese.reading.fieldPos")}
                value={t(japanesePosLabelKey(word.pos))}
              />
              <DetailField
                label={t("japanese.reading.fieldRomaji")}
                value={word.romaji ?? EMPTY}
              />
              <DetailField
                label={t("japanese.reading.fieldReading")}
                value={word.reading ?? EMPTY}
              />
            </View>

            <JapaneseSectionTitle className="mt-1">
              {t("japanese.reading.morphemes")}
            </JapaneseSectionTitle>
            <View className="mt-1">
              {morphemes.map((morpheme, index) => (
                <View
                  accessible
                  className={
                    index < morphemes.length - 1
                      ? "flex-row items-baseline justify-between gap-3 border-b border-border py-2"
                      : "flex-row items-baseline justify-between gap-3 py-2"
                  }
                  key={`${morpheme.start}-${morpheme.surface}`}
                >
                  <Text className="text-base text-foreground">
                    {morpheme.surface}
                    {morpheme.baseForm &&
                    morpheme.baseForm !== morpheme.surface ? (
                      <Text className="text-xs text-muted">
                        {"  "}
                        {morpheme.baseForm}
                      </Text>
                    ) : null}
                  </Text>
                  <Text className="shrink-0 text-xs text-muted">
                    {t(japanesePosLabelKey(morpheme.learnerPos))}
                  </Text>
                </View>
              ))}
            </View>

            <Button className="mt-4" onPress={handleLookUp} variant="secondary">
              <Button.Label>
                {t("japanese.reading.lookUp", { word: word.baseForm })}
              </Button.Label>
            </Button>
          </View>
        ) : null}
      </BottomSheet.Content>
    </BottomSheet>
  )
}
