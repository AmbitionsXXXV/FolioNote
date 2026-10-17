import type { Morpheme, RubySegment, Word } from "@folionote/japanese"
import { cn } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { splitRubyAt } from "@/lib/japanese-furigana"
import {
  JAPANESE_POS_UNDERLINE_CLASS,
  JAPANESE_TAIL_UNDERLINE_CLASS,
  japanesePosLabelKey
} from "@/lib/japanese-pos"

import { JapaneseRuby } from "./japanese-ruby"

export const READING_UNIT_FONT_SIZE = 24

const UNIT_CLASS = "items-center rounded-xl px-1.5 pt-1 pb-1"
const SELECTED_CLASS = "bg-accent/15"
const ROMAJI_CLASS = "mt-1 text-[10px] leading-3 text-muted"
const UNIT_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 }

interface UnderlinedRubyProps {
  segments: RubySegment[]
  underlineClassName: string
  showFurigana: boolean
  textClassName?: string
}

/** Surface text with a 3pt bar beneath it; the bar carries the POS colour. */
function UnderlinedRuby({
  segments,
  underlineClassName,
  showFurigana,
  textClassName
}: UnderlinedRubyProps) {
  return (
    <View>
      <JapaneseRuby
        accessible={false}
        fontSize={READING_UNIT_FONT_SIZE}
        segments={segments}
        showReading={showFurigana}
        textClassName={textClassName}
      />
      <View className={cn("mt-0.5 h-0.75 rounded-full", underlineClassName)} />
    </View>
  )
}

/** Mirrors the unit layout so punctuation sits on the text baseline, not the romaji row. */
function Punctuation({
  surface,
  showFurigana,
  showRomaji,
  showPosTag = false
}: {
  surface: string
  showFurigana: boolean
  showRomaji: boolean
  /** Morpheme units carry a POS tag row too. */
  showPosTag?: boolean
}) {
  return (
    <View
      className={UNIT_CLASS}
      importantForAccessibility="no-hide-descendants"
    >
      <UnderlinedRuby
        segments={[{ text: surface }]}
        showFurigana={showFurigana}
        textClassName="text-muted"
        underlineClassName="bg-transparent"
      />
      {showPosTag ? <View className="mt-1 h-3" /> : null}
      {showRomaji ? <View className="mt-1 h-3" /> : null}
    </View>
  )
}

interface JapaneseWordUnitProps {
  word: Word
  isSelected: boolean
  showFurigana: boolean
  showRomaji: boolean
  onSelect: (word: Word) => void
}

export function JapaneseWordUnit({
  word,
  isSelected,
  showFurigana,
  showRomaji,
  onSelect
}: JapaneseWordUnitProps) {
  const { t } = useTranslation()

  if (word.isPunctuation) {
    return (
      <Punctuation
        showFurigana={showFurigana}
        showRomaji={showRomaji}
        surface={word.surface}
      />
    )
  }

  const segments = word.ruby ?? [{ text: word.surface }]
  const tailOffset = word.tail ? word.tail.start - word.start : null
  const [head, tail] =
    tailOffset === null ? [segments, []] : splitRubyAt(segments, tailOffset)
  const label = [word.surface, word.reading, t(japanesePosLabelKey(word.pos))]
    .filter(Boolean)
    .join("、")

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={cn(UNIT_CLASS, isSelected && SELECTED_CLASS)}
      hitSlop={UNIT_HIT_SLOP}
      onPress={() => onSelect(word)}
    >
      <View className="flex-row items-end">
        <UnderlinedRuby
          segments={head}
          showFurigana={showFurigana}
          underlineClassName={JAPANESE_POS_UNDERLINE_CLASS[word.pos]}
        />
        {tail.length > 0 ? (
          <UnderlinedRuby
            segments={tail}
            showFurigana={showFurigana}
            underlineClassName={JAPANESE_TAIL_UNDERLINE_CLASS}
          />
        ) : null}
      </View>
      {showRomaji ? (
        <Text className={ROMAJI_CLASS}>{word.romaji ?? " "}</Text>
      ) : null}
    </Pressable>
  )
}

interface JapaneseMorphemeUnitProps {
  morpheme: Morpheme
  isSelected: boolean
  showFurigana: boolean
  showRomaji: boolean
  onSelect: () => void
}

/** Raw dictionary morpheme with its Japanese POS tag; selecting it selects its word. */
export function JapaneseMorphemeUnit({
  morpheme,
  isSelected,
  showFurigana,
  showRomaji,
  onSelect
}: JapaneseMorphemeUnitProps) {
  if (morpheme.isPunctuation) {
    return (
      <Punctuation
        showFurigana={showFurigana}
        showPosTag
        showRomaji={showRomaji}
        surface={morpheme.surface}
      />
    )
  }

  const segments = morpheme.ruby ?? [{ text: morpheme.surface }]
  const label = [morpheme.surface, morpheme.reading, morpheme.pos]
    .filter(Boolean)
    .join("、")

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={cn(UNIT_CLASS, isSelected && SELECTED_CLASS)}
      hitSlop={UNIT_HIT_SLOP}
      onPress={onSelect}
    >
      <UnderlinedRuby
        segments={segments}
        showFurigana={showFurigana}
        underlineClassName={JAPANESE_POS_UNDERLINE_CLASS[morpheme.learnerPos]}
      />
      <Text className="mt-1 rounded-sm bg-default px-1 text-[10px] leading-3 text-muted">
        {morpheme.pos}
      </Text>
      {showRomaji ? (
        <Text className={ROMAJI_CLASS}>{morpheme.romaji ?? " "}</Text>
      ) : null}
    </Pressable>
  )
}
