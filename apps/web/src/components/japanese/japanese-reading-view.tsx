import { useQueries } from "@tanstack/react-query"
import type { ChangeEvent, ReactNode } from "react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { useBrowserJapanese } from "@/hooks/use-browser-japanese"
import { useJapaneseLexiconLookup } from "@/hooks/use-japanese-lexicon-lookup"
import { contentBaseForms } from "@/lib/japanese-article"
import type { JapanesePartOfSpeech } from "@/lib/japanese-typing"
import { ALL_JAPANESE_POS_CATEGORIES } from "@/lib/japanese-typing"
import {
  analyzeSentence,
  isServerUnavailable
} from "@/lib/japanese/analyze-sentence"
import { enableBrowserEngine } from "@/lib/japanese/browser-engine"

import type { JapaneseReadingUnit } from "./japanese-analyzed-sentence"
import { JapaneseAnalyzedSentenceView } from "./japanese-analyzed-sentence"
import {
  JapaneseBrowserEngineBadge,
  JapaneseBrowserEngineBanner
} from "./japanese-browser-engine-banner"
import { JapanesePosLegend } from "./japanese-pos-legend"
import {
  NATIVE_SELECT_CLASS,
  SentenceError,
  SentenceSkeleton,
  TogglePill,
  UnitSelector
} from "./japanese-reading-controls"
import type { JapaneseReadingSentence } from "./japanese-reading-data"
import {
  JAPANESE_READING_WORKS,
  resolveReadingLocale
} from "./japanese-reading-data"
import { SelectedWordPanel } from "./japanese-selected-word-panel"

interface SelectedWordRef {
  sentenceId: string
  wordIndex: number
}

export function JapaneseReadingView() {
  const { i18n, t } = useTranslation()
  const [selectedWorkId, setSelectedWorkId] = useState(
    JAPANESE_READING_WORKS[0]?.id ?? ""
  )
  const [unit, setUnit] = useState<JapaneseReadingUnit>("word")
  const [showFurigana, setShowFurigana] = useState(true)
  const [showRomaji, setShowRomaji] = useState(true)
  const [enabledPosCategories, setEnabledPosCategories] = useState<
    Set<JapanesePartOfSpeech>
  >(() => new Set(ALL_JAPANESE_POS_CATEGORIES))
  const [selected, setSelected] = useState<SelectedWordRef | null>(null)
  const engine = useBrowserJapanese()

  const selectedWork =
    JAPANESE_READING_WORKS.find((work) => work.id === selectedWorkId) ??
    JAPANESE_READING_WORKS[0]
  const sentences: JapaneseReadingSentence[] = selectedWork?.sentences ?? []
  const readingLocale = resolveReadingLocale(
    i18n.resolvedLanguage ?? i18n.language
  )

  // One request per sentence keeps offsets simple and lets a single failure
  // retry on its own. The global error toast is muted: the inline state
  // already explains what happened.
  // `combine` output is structurally shared, so baseForms keeps its identity
  // (and the lexicon lookup its query keys) until a sentence analysis lands.
  const { analyses, baseForms } = useQueries({
    queries: sentences.map((sentence) => ({
      queryKey: ["japanese", "analyze-sentence", sentence.text],
      queryFn: () => analyzeSentence(sentence.text),
      staleTime: Number.POSITIVE_INFINITY,
      retry: 1,
      meta: { silentError: true }
    })),
    combine: (results) => ({
      analyses: results,
      baseForms: contentBaseForms(
        results.map((result) => result.data?.analysis ?? null)
      )
    })
  })
  const lexicons = useJapaneseLexiconLookup(baseForms)
  const serverUnavailable = analyses.some(
    (query) => query.isError && isServerUnavailable(query.error)
  )
  const analyzedInBrowser = analyses.some(
    (query) => query.data?.source === "browser"
  )

  const handleEnableBrowserEngine = async () => {
    try {
      await enableBrowserEngine()
    } catch {
      // The banner shows engine.error; nothing else to do here.
      return
    }
    for (const query of analyses) {
      if (query.isError) void query.refetch()
    }
  }

  const handleToggle = useCallback((category: JapanesePartOfSpeech) => {
    setEnabledPosCategories((previous) => {
      const next = new Set(previous)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  const handleWorkChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedWorkId(event.target.value)
      setSelected(null)
    },
    []
  )

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

  if (!selectedWork) {
    return null
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <section
        aria-labelledby="japanese-reading-work-title"
        className="border-b border-border/60 pb-5"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className="font-script-ja text-xs text-muted-foreground"
              lang="ja"
            >
              {selectedWork.titleReading}
            </p>
            <h1
              className="font-display text-2xl font-semibold tracking-tight"
              id="japanese-reading-work-title"
              lang="ja"
            >
              {selectedWork.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedWork.author} · {selectedWork.firstPublishedYear}
            </p>
          </div>

          <label className="flex w-full flex-col gap-1.5 text-xs font-medium text-muted-foreground sm:w-64">
            {t("japanese.reading.workPickerLabel")}
            <select
              className={NATIVE_SELECT_CLASS}
              onChange={handleWorkChange}
              value={selectedWork.id}
            >
              {JAPANESE_READING_WORKS.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.title} — {work.author}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {selectedWork.descriptions[readingLocale]}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span>
            {t("japanese.reading.excerptCount", {
              count: selectedWork.sentences.length
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t("japanese.reading.publicDomain")}</span>
          <span aria-hidden="true">·</span>
          <a
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            href={selectedWork.sourceUrl}
            rel="noopener"
            target="_blank"
          >
            {t("japanese.reading.openOriginal", {
              source: selectedWork.sourceName
            })}
          </a>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <UnitSelector onChange={setUnit} unit={unit} />
        <div className="flex items-center gap-1.5">
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
        </div>
        <JapanesePosLegend
          enabledPosCategories={enabledPosCategories}
          onToggle={handleToggle}
        />
        {analyzedInBrowser && <JapaneseBrowserEngineBadge />}
      </div>

      <div className="mt-5 empty:hidden">
        <JapaneseBrowserEngineBanner
          engine={engine}
          onEnable={() => {
            void handleEnableBrowserEngine()
          }}
          serverUnavailable={serverUnavailable}
        />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col divide-y divide-border/40">
          {sentences.map((sentence, index) => {
            const query = analyses[index]
            let body: ReactNode
            if (!query || query.isPending) {
              body = <SentenceSkeleton />
            } else if (query.isError) {
              // Keep the text readable even when segmentation is unavailable.
              body = (
                <div className="space-y-3">
                  <p
                    className="font-script-ja text-2xl leading-relaxed"
                    lang="ja"
                  >
                    {sentence.text}
                  </p>
                  <SentenceError
                    error={query.error}
                    onRetry={() => {
                      query.refetch()
                    }}
                  />
                </div>
              )
            } else {
              body = (
                <JapaneseAnalyzedSentenceView
                  analysis={query.data.analysis}
                  enabledPosCategories={enabledPosCategories}
                  lexiconTags={lexicons.tags}
                  onSelectWord={(word) =>
                    setSelected((previous) =>
                      previous?.sentenceId === sentence.id &&
                      previous.wordIndex === word.index
                        ? null
                        : { sentenceId: sentence.id, wordIndex: word.index }
                    )
                  }
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
              <div className="py-3" key={sentence.id}>
                {body}
                <p className="mt-4 text-sm text-muted-foreground">
                  <span className="opacity-60">
                    {t("japanese.reading.translationLabel")}：
                  </span>
                  {sentence.translations[readingLocale]}
                </p>
              </div>
            )
          })}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {selectedWord && selectedAnalysis ? (
            <SelectedWordPanel
              analysis={selectedAnalysis}
              lexiconMatches={lexicons.matches.get(selectedWord.baseForm)}
              word={selectedWord}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground/80">
              {t("japanese.reading.selectHint")}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
