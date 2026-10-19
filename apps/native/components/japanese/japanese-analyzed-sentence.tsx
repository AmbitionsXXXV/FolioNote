import type { AnalyzedText, Phrase, Word } from "@folionote/japanese"
import type { ReactNode } from "react"
import { View } from "react-native"

import { JapaneseMorphemeUnit, JapaneseWordUnit } from "./japanese-reading-unit"

export type JapaneseReadingUnit = "word" | "phrase" | "morpheme"

interface JapaneseAnalyzedSentenceViewProps {
  analysis: AnalyzedText
  unit: JapaneseReadingUnit
  selectedWordIndex: number | null
  onSelectWord: (word: Word) => void
  showFurigana: boolean
  showRomaji: boolean
}

/** A thin bracket beneath the phrase instead of a box: ⌊ 食べてみました。⌋ */
const PHRASE_GROUP_CLASS =
  "mx-0.5 mb-1 flex-row flex-wrap items-end rounded-b-sm border-x border-b border-muted/40 pb-1.5"

export function JapaneseAnalyzedSentenceView({
  analysis,
  unit,
  selectedWordIndex,
  onSelectWord,
  showFurigana,
  showRomaji
}: JapaneseAnalyzedSentenceViewProps) {
  const renderWord = (word: Word) => (
    <JapaneseWordUnit
      isSelected={selectedWordIndex === word.index}
      key={word.index}
      onSelect={onSelectWord}
      showFurigana={showFurigana}
      showRomaji={showRomaji}
      word={word}
    />
  )

  let units: ReactNode
  if (unit === "word") {
    units = analysis.words.map(renderWord)
  } else if (unit === "phrase") {
    units = renderPhrases(analysis, renderWord)
  } else {
    units = renderMorphemes(analysis, {
      selectedWordIndex,
      onSelectWord,
      showFurigana,
      showRomaji
    })
  }

  return <View className="flex-row flex-wrap items-end gap-y-2">{units}</View>
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
        <View className={PHRASE_GROUP_CLASS} key={`phrase-${phrase.index}`}>
          {phrase.wordIndexes.map((index) => {
            const member = analysis.words[index]
            return member ? renderWord(member) : null
          })}
        </View>
      )
    } else if (!covered.has(word.index)) {
      nodes.push(renderWord(word))
    }
  }
  return nodes
}

interface MorphemeRenderOptions {
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
