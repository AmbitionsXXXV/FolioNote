import type { AnalyzedText, Word } from "@folionote/japanese"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useJapaneseLexiconLookup } from "@/hooks/use-japanese-lexicon-lookup"
import { contentBaseForms } from "@/lib/japanese-article"
import { ALL_JAPANESE_POS_CATEGORIES } from "@/lib/japanese-pos"
import { analyzeSentence } from "@/lib/japanese/analyze-sentence"

import { JapaneseAnalyzedSentenceView } from "../japanese-analyzed-sentence"
import { SelectedWordPanel } from "../japanese-selected-word-panel"

const ALL_POS = new Set(ALL_JAPANESE_POS_CATEGORIES)

/** Same cache key as the reading pages, so a line analyzed once stays analyzed. */
export const analyzedLineQuery = (text: string) => ({
  queryKey: ["japanese", "analyze-sentence", text],
  queryFn: () => analyzeSentence(text),
  staleTime: Number.POSITIVE_INFINITY,
  retry: 1,
  meta: { silentError: true }
})

/**
 * The current caption line as tappable words. Until the analysis arrives (or
 * if it fails) the plain text shows, so listening never waits on the analyzer.
 */
export function ListenLineWords({
  text,
  selectedWordIndex,
  onSelectWord
}: {
  text: string
  selectedWordIndex: number | null
  onSelectWord: (word: Word, analysis: AnalyzedText) => void
}) {
  const analysis = useQuery(analyzedLineQuery(text)).data?.analysis
  if (!analysis) {
    return (
      <span className="whitespace-pre-line" lang="ja">
        {text}
      </span>
    )
  }
  return (
    <JapaneseAnalyzedSentenceView
      analysis={analysis}
      enabledPosCategories={ALL_POS}
      onSelectWord={(word) => onSelectWord(word, analysis)}
      selectedWordIndex={selectedWordIndex}
      showFurigana
      showRomaji={false}
      unit="word"
    />
  )
}

/** The tapped word's details + save button; the save keeps the video and line time. */
export function ListenWordPanel({
  word,
  analysis,
  materialId,
  timeMs
}: {
  word: Word
  analysis: AnalyzedText
  materialId: string
  timeMs: number
}) {
  const baseForms = useMemo(() => contentBaseForms([analysis]), [analysis])
  const lexicons = useJapaneseLexiconLookup(baseForms)
  return (
    <SelectedWordPanel
      allowSave
      analysis={analysis}
      lexiconMatches={lexicons.matches.get(word.baseForm)}
      videoContext={{ materialId, timeMs }}
      word={word}
    />
  )
}
