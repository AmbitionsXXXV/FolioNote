import type { Morpheme, RubySegment, Word } from "@folionote/japanese"

import { splitRubyAt } from "@/lib/japanese-furigana"
import type { JapanesePartOfSpeech } from "@/lib/japanese-pos"
import { JAPANESE_POS_SWATCH_COLOR_MAP } from "@/lib/japanese-pos"
import { cn } from "@/lib/utils"

import { JapaneseRuby } from "./japanese-ruby"

/** Inflection tails (てみました) share one muted colour instead of a POS colour. */
const TAIL_UNDERLINE_CLASS = "bg-muted-foreground/35"
const DIMMED_UNDERLINE_CLASS = "bg-border"

const UNIT_BUTTON_CLASS =
  "group inline-flex flex-col items-center rounded-lg px-1 pt-3 pb-1 transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"

const SURFACE_CLASS =
  "flex items-end whitespace-nowrap font-script-ja text-2xl leading-tight font-medium"

interface UnderlinedRubyProps {
  segments: RubySegment[]
  underlineClass: string
  showFurigana: boolean
}

/** Surface text with a 3px bar beneath it; the bar carries the POS colour. */
function UnderlinedRuby({
  segments,
  underlineClass,
  showFurigana
}: UnderlinedRubyProps) {
  return (
    <span className="relative pb-1">
      <JapaneseRuby segments={segments} showReading={showFurigana} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 h-[3px] rounded-full",
          underlineClass
        )}
      />
    </span>
  )
}

/** Row height reserved under every unit when any word in the sentence carries a list tag. */
const TAG_ROW_CLASS = "mt-1 flex h-3.5 items-center"

/** "In your lists" marker: list name, level and unit, kept tiny so it never competes with the text. */
function LexiconTag({ label }: { label: string }) {
  return (
    <span
      className="max-w-28 truncate rounded-sm bg-primary/12 px-1 text-[9px] leading-[14px] font-medium text-primary"
      title={label}
    >
      {label}
    </span>
  )
}

/** Mirrors the unit layout so punctuation sits on the text baseline, not the romaji row. */
function Punctuation({
  surface,
  showRomaji,
  showPosTag = false,
  reserveTagRow = false
}: {
  surface: string
  showRomaji: boolean
  /** Morpheme units carry a POS tag row too. */
  showPosTag?: boolean
  reserveTagRow?: boolean
}) {
  return (
    <span className="inline-flex flex-col items-center px-0.5 pt-3 pb-1">
      <span
        className="pb-1 font-script-ja text-2xl leading-tight text-muted-foreground select-none"
        lang="ja"
      >
        {surface}
      </span>
      {showPosTag ? <span aria-hidden="true" className="mt-1.5 h-3.5" /> : null}
      {showRomaji ? (
        <span
          aria-hidden="true"
          className={showPosTag ? "mt-1 h-2.5" : "mt-1.5 h-2.5"}
        />
      ) : null}
      {reserveTagRow ? (
        <span aria-hidden="true" className={TAG_ROW_CLASS} />
      ) : null}
    </span>
  )
}

const posUnderline = (pos: JapanesePartOfSpeech, isDimmed: boolean) =>
  isDimmed ? DIMMED_UNDERLINE_CLASS : JAPANESE_POS_SWATCH_COLOR_MAP[pos]

interface JapaneseWordUnitProps {
  word: Word
  isSelected: boolean
  /** The word's POS category is toggled off in the legend. */
  isDimmed: boolean
  showFurigana: boolean
  showRomaji: boolean
  onSelect: (word: Word) => void
  /** Label from the reader's own word lists, e.g. "红宝书 N2 · 3". */
  tag?: string | null
  /** Keep the tag row even without a tag so neighbouring units stay aligned. */
  reserveTagRow?: boolean
  /** Shade words the reader has not collected in any list yet. */
  isNew?: boolean
}

export function JapaneseWordUnit({
  word,
  isSelected,
  isDimmed,
  showFurigana,
  showRomaji,
  onSelect,
  tag = null,
  reserveTagRow = false,
  isNew = false
}: JapaneseWordUnitProps) {
  if (word.isPunctuation) {
    return (
      <Punctuation
        reserveTagRow={reserveTagRow}
        showRomaji={showRomaji}
        surface={word.surface}
      />
    )
  }

  const segments = word.ruby ?? [{ text: word.surface }]
  const tailOffset = word.tail ? word.tail.start - word.start : null
  const [head, tail] =
    tailOffset === null ? [segments, []] : splitRubyAt(segments, tailOffset)

  let stateClass = "hover:bg-surface-secondary/70"
  if (isSelected) {
    stateClass = "bg-primary/12 ring-1 ring-primary/30"
  } else if (isNew) {
    stateClass = "bg-primary/8 hover:bg-primary/12"
  }

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        UNIT_BUTTON_CLASS,
        stateClass,
        isDimmed && "text-muted-foreground"
      )}
      data-new-word={isNew ? "true" : undefined}
      onClick={() => onSelect(word)}
      type="button"
    >
      <span className={SURFACE_CLASS}>
        <UnderlinedRuby
          segments={head}
          showFurigana={showFurigana}
          underlineClass={posUnderline(word.pos, isDimmed)}
        />
        {tail.length > 0 ? (
          <UnderlinedRuby
            segments={tail}
            showFurigana={showFurigana}
            underlineClass={
              isDimmed ? DIMMED_UNDERLINE_CLASS : TAIL_UNDERLINE_CLASS
            }
          />
        ) : null}
      </span>
      {showRomaji && word.romaji ? (
        <span className="mt-1.5 font-mono text-[10px] leading-none text-muted-foreground">
          {word.romaji}
        </span>
      ) : null}
      {reserveTagRow ? (
        <span className={TAG_ROW_CLASS}>
          {tag ? <LexiconTag label={tag} /> : null}
        </span>
      ) : null}
    </button>
  )
}

interface JapaneseMorphemeUnitProps {
  morpheme: Morpheme
  isSelected: boolean
  isDimmed: boolean
  showFurigana: boolean
  showRomaji: boolean
  onSelect: () => void
}

/** Raw dictionary morpheme with its Japanese POS tag; selecting it selects its word. */
export function JapaneseMorphemeUnit({
  morpheme,
  isSelected,
  isDimmed,
  showFurigana,
  showRomaji,
  onSelect
}: JapaneseMorphemeUnitProps) {
  if (morpheme.isPunctuation) {
    return (
      <Punctuation
        showPosTag
        showRomaji={showRomaji}
        surface={morpheme.surface}
      />
    )
  }

  const segments = morpheme.ruby ?? [{ text: morpheme.surface }]

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        UNIT_BUTTON_CLASS,
        isSelected
          ? "bg-primary/12 ring-1 ring-primary/30"
          : "hover:bg-surface-secondary/70",
        isDimmed && "text-muted-foreground"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className={SURFACE_CLASS}>
        <UnderlinedRuby
          segments={segments}
          showFurigana={showFurigana}
          underlineClass={posUnderline(morpheme.learnerPos, isDimmed)}
        />
      </span>
      <span
        className="mt-1.5 rounded-sm bg-surface-secondary px-1 py-px text-[10px] leading-none text-muted-foreground"
        lang="ja"
      >
        {morpheme.pos}
      </span>
      {showRomaji && morpheme.romaji ? (
        <span className="mt-1 font-mono text-[10px] leading-none text-muted-foreground">
          {morpheme.romaji}
        </span>
      ) : null}
    </button>
  )
}
