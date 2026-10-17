import type { AnalyzedText, Phrase, Word } from "@folionote/japanese"
import type { ReactNode } from "react"

import type { JapanesePartOfSpeech } from "@/lib/japanese-typing"

import { JapaneseMorphemeUnit, JapaneseWordUnit } from "./japanese-reading-unit"

export type JapaneseReadingUnit = "word" | "phrase" | "morpheme"

interface JapaneseAnalyzedSentenceViewProps {
  analysis: AnalyzedText
  unit: JapaneseReadingUnit
  enabledPosCategories: Set<JapanesePartOfSpeech>
  selectedWordIndex: number | null
  onSelectWord: (word: Word) => void
  showFurigana: boolean
  showRomaji: boolean
  /** Dictionary form → "in your lists" label; tagged words get a marker row. */
  lexiconTags?: ReadonlyMap<string, string>
  /** Dictionary forms to shade as not yet collected (import preview). */
  newBaseForms?: ReadonlySet<string>
}

/** A thin bracket beneath the phrase instead of a box: ⌊ 食べてみました。⌋ */
const PHRASE_GROUP_CLASS =
  "relative inline-flex flex-wrap items-end pb-2.5 after:pointer-events-none after:absolute after:inset-x-1 after:bottom-0 after:h-2 after:rounded-b-sm after:border-x after:border-b after:border-muted-foreground/40 after:content-['']"

const NO_TAGS: ReadonlyMap<string, string> = new Map()
const NO_NEW_WORDS: ReadonlySet<string> = new Set()

export function JapaneseAnalyzedSentenceView({
  analysis,
  unit,
  enabledPosCategories,
  selectedWordIndex,
  onSelectWord,
  showFurigana,
  showRomaji,
  lexiconTags = NO_TAGS,
  newBaseForms = NO_NEW_WORDS
}: JapaneseAnalyzedSentenceViewProps) {
  // Morpheme units show the raw POS tag instead; list tags belong to words.
  const reserveTagRow =
    unit !== "morpheme" &&
    analysis.words.some((word) => lexiconTags.has(word.baseForm))

  const renderWord = (word: Word) => (
    <JapaneseWordUnit
      isDimmed={!enabledPosCategories.has(word.pos)}
      isNew={!word.isPunctuation && newBaseForms.has(word.baseForm)}
      isSelected={selectedWordIndex === word.index}
      key={word.index}
      onSelect={onSelectWord}
      reserveTagRow={reserveTagRow}
      showFurigana={showFurigana}
      showRomaji={showRomaji}
      tag={lexiconTags.get(word.baseForm) ?? null}
      word={word}
    />
  )

  let units: ReactNode
  if (unit === "word") {
    units = renderWords(analysis, renderWord)
  } else if (unit === "phrase") {
    units = renderPhrases(analysis, renderWord)
  } else {
    units = renderMorphemes(analysis, {
      enabledPosCategories,
      selectedWordIndex,
      onSelectWord,
      showFurigana,
      showRomaji
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-x-0.5 gap-y-3" lang="ja">
      {units}
    </div>
  )
}

/**
 * Words with trailing punctuation glued to the word before it, so a line never
 * wraps to a lone 。or 、.
 */
function renderWords(
  analysis: AnalyzedText,
  renderWord: (word: Word) => ReactNode
): ReactNode[] {
  const nodes: ReactNode[] = []
  let group: Word[] = []
  const flush = () => {
    const [first] = group
    if (!first) return
    nodes.push(
      group.length === 1 ? (
        renderWord(first)
      ) : (
        <span className="inline-flex items-end" key={`group-${first.index}`}>
          {group.map(renderWord)}
        </span>
      )
    )
    group = []
  }
  for (const word of analysis.words) {
    if (word.isPunctuation && group.length > 0) {
      group.push(word)
      continue
    }
    flush()
    group = [word]
  }
  flush()
  return nodes
}

/**
 * Words in phrase order, each phrase wrapped in a bracket group. A word that
 * no phrase claims renders loose so nothing from the text goes missing.
 */
function renderPhrases(
  analysis: AnalyzedText,
  renderWord: (word: Word) => ReactNode
): ReactNode[] {
  const phraseByFirstWord = new Map<number, Phrase>()
  const covered = new Set<number>()
  for (const phrase of analysis.phrases) {
    const [first] = phrase.wordIndexes
    if (first !== undefined) {
      phraseByFirstWord.set(first, phrase)
    }
    for (const index of phrase.wordIndexes) {
      covered.add(index)
    }
  }

  const nodes: ReactNode[] = []
  for (const word of analysis.words) {
    const phrase = phraseByFirstWord.get(word.index)
    if (phrase) {
      nodes.push(
        <span className={PHRASE_GROUP_CLASS} key={`phrase-${phrase.index}`}>
          {phrase.wordIndexes.map((index) => {
            const member = analysis.words[index]
            return member ? renderWord(member) : null
          })}
        </span>
      )
    } else if (!covered.has(word.index)) {
      nodes.push(renderWord(word))
    }
  }
  return nodes
}

interface MorphemeRenderOptions {
  enabledPosCategories: Set<JapanesePartOfSpeech>
  selectedWordIndex: number | null
  onSelectWord: (word: Word) => void
  showFurigana: boolean
  showRomaji: boolean
}

function renderMorphemes(
  analysis: AnalyzedText,
  options: MorphemeRenderOptions
): ReactNode[] {
  const wordByMorpheme = new Map<number, Word>()
  for (const word of analysis.words) {
    for (const index of word.morphemeIndexes) {
      wordByMorpheme.set(index, word)
    }
  }

  return analysis.morphemes.map((morpheme, index) => {
    const parent = wordByMorpheme.get(index)
    return (
      <JapaneseMorphemeUnit
        isDimmed={!options.enabledPosCategories.has(morpheme.learnerPos)}
        isSelected={
          parent !== undefined && options.selectedWordIndex === parent.index
        }
        key={`${morpheme.start}-${morpheme.surface}`}
        morpheme={morpheme}
        onSelect={() => {
          if (parent) {
            options.onSelectWord(parent)
          }
        }}
        showFurigana={options.showFurigana}
        showRomaji={options.showRomaji}
      />
    )
  })
}
