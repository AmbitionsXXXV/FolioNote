import type { AnalyzedText } from "@folionote/japanese"
import { Skeleton } from "@folionote/ui/skeleton"
import { Button } from "@heroui/react"
import { ArrowLeft01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useBrowserJapanese } from "@/hooks/use-browser-japanese"
import { useJapaneseLexiconLookup } from "@/hooks/use-japanese-lexicon-lookup"
import { articleParagraphs, contentBaseForms } from "@/lib/japanese-article"
import type { ArticleParagraph } from "@/lib/japanese-article"
import type { JapanesePartOfSpeech } from "@/lib/japanese-typing"
import { ALL_JAPANESE_POS_CATEGORIES } from "@/lib/japanese-typing"
import { isServerUnavailable } from "@/lib/japanese/analyze-sentence"
import {
  analyzeInBrowser,
  enableBrowserEngine
} from "@/lib/japanese/browser-engine"
import { orpc } from "@/utils/orpc"

import type { JapaneseReadingUnit } from "./japanese-analyzed-sentence"
import { JapaneseAnalyzedSentenceView } from "./japanese-analyzed-sentence"
import {
  JapaneseBrowserEngineBadge,
  JapaneseBrowserEngineBanner
} from "./japanese-browser-engine-banner"
import { JapanesePosLegend } from "./japanese-pos-legend"
import {
  isServiceUnavailable,
  ReadingDisplayToggles,
  UnitSelector
} from "./japanese-reading-controls"
import { SelectedWordPanel } from "./japanese-selected-word-panel"

interface SelectedWordRef {
  sentenceId: string
  wordIndex: number
}

const BACK_LINK_CLASS =
  "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

function ArticleSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  )
}

function PendingAnalysisNotice({
  onAnalyze,
  isAnalyzing,
  error
}: {
  onAnalyze: () => void
  isAnalyzing: boolean
  error: unknown
}) {
  const { t } = useTranslation()
  let message = t("japanese.library.article.pendingAnalysis")
  if (error && !isServiceUnavailable(error)) {
    message = t("japanese.reading.analyzeFailed")
  }
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground"
      role="alert"
    >
      <span>{message}</span>
      <Button
        isDisabled={isAnalyzing}
        onPress={onAnalyze}
        size="sm"
        variant="outline"
      >
        {isAnalyzing
          ? t("japanese.library.article.analyzing")
          : t("japanese.library.article.analyzeNow")}
      </Button>
    </div>
  )
}

/**
 * Fills the sentences the server has not analyzed with this browser's own
 * analysis, for display only: the stored article stays untouched.
 */
function withBrowserAnalyses(
  paragraphs: ArticleParagraph[],
  local: ReadonlyMap<string, AnalyzedText>
): ArticleParagraph[] {
  if (local.size === 0) return paragraphs
  return paragraphs.map((paragraph) => ({
    ...paragraph,
    sentences: paragraph.sentences.map((sentence) =>
      sentence.analysis
        ? sentence
        : { ...sentence, analysis: local.get(sentence.id) ?? null }
    )
  }))
}

export function JapaneseArticleReadingView({
  articleId
}: {
  articleId: string
}) {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const engine = useBrowserJapanese()
  const [unit, setUnit] = useState<JapaneseReadingUnit>("word")
  const [showFurigana, setShowFurigana] = useState(true)
  const [showRomaji, setShowRomaji] = useState(false)
  const [enabledPosCategories, setEnabledPosCategories] = useState<
    Set<JapanesePartOfSpeech>
  >(() => new Set(ALL_JAPANESE_POS_CATEGORIES))
  const [selected, setSelected] = useState<SelectedWordRef | null>(null)

  const articleQuery = useQuery({
    ...orpc.japanese.articles.get.queryOptions({ input: { id: articleId } }),
    retry: false,
    meta: { silentError: true }
  })
  const article = articleQuery.data

  const reanalyze = useMutation({
    mutationFn: () => orpc.japanese.articles.reanalyze.call({ id: articleId }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        orpc.japanese.articles.get.queryKey({ input: { id: articleId } }),
        updated
      )
      queryClient.invalidateQueries({
        queryKey: orpc.japanese.articles.list.key()
      })
    }
  })

  const storedParagraphs = useMemo(
    () => (article ? articleParagraphs(article.text, article.analysis) : []),
    [article]
  )
  const isAnalyzed = article !== undefined && article.analysis !== null

  // Sentences without a stored analysis are analyzed in this browser when the
  // reader opted in earlier (the dictionary is cached) or just did so.
  const canAnalyzeInBrowser =
    engine.consent === true &&
    (engine.dictionary !== null || engine.status === "ready")
  const pendingSentences = useMemo(
    () =>
      isAnalyzed
        ? []
        : storedParagraphs
            .flatMap((paragraph) => paragraph.sentences)
            .filter((sentence) => sentence.analysis === null),
    [isAnalyzed, storedParagraphs]
  )
  const browserAnalyses = useQueries({
    queries: pendingSentences.map((sentence) => ({
      queryKey: ["japanese", "browser-analyze", sentence.text],
      queryFn: () => analyzeInBrowser(sentence.text),
      enabled: canAnalyzeInBrowser,
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
      meta: { silentError: true }
    })),
    combine: (results) => {
      const local = new Map<string, AnalyzedText>()
      for (const [index, result] of results.entries()) {
        const sentence = pendingSentences[index]
        if (sentence && result.data) local.set(sentence.id, result.data)
      }
      return local
    }
  })
  const analyzedInBrowser = browserAnalyses.size > 0

  const paragraphs = useMemo(
    () => withBrowserAnalyses(storedParagraphs, browserAnalyses),
    [browserAnalyses, storedParagraphs]
  )
  const sentences = useMemo(
    () => paragraphs.flatMap((paragraph) => paragraph.sentences),
    [paragraphs]
  )
  const baseForms = useMemo(
    () => contentBaseForms(sentences.map((sentence) => sentence.analysis)),
    [sentences]
  )
  const lexicons = useJapaneseLexiconLookup(baseForms)

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

  const backLink = (
    <Link className={BACK_LINK_CLASS} to="/japanese/library">
      <HugeiconsIcon
        aria-hidden="true"
        className="size-4"
        icon={ArrowLeft01Icon}
      />
      {t("japanese.library.article.back")}
    </Link>
  )

  if (articleQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-16">
        {backLink}
        <div className="mt-6">
          <ArticleSkeleton />
        </div>
      </div>
    )
  }

  if (articleQuery.isError || !article) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-16">
        {backLink}
        <div className="mt-10 text-center">
          <h1 className="font-display text-2xl font-semibold">
            {t("japanese.library.article.notFound")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("japanese.library.article.notFoundHint")}
          </p>
        </div>
      </div>
    )
  }

  const selectedSentence = selected
    ? sentences.find((sentence) => sentence.id === selected.sentenceId)
    : undefined
  const selectedWord =
    selected && selectedSentence?.analysis
      ? selectedSentence.analysis.words[selected.wordIndex]
      : undefined
  const hasAnalysis = isAnalyzed || analyzedInBrowser
  const serverUnavailable =
    reanalyze.isError && isServerUnavailable(reanalyze.error)
  const createdAt = new Date(article.createdAt).toLocaleDateString(
    i18n.resolvedLanguage ?? i18n.language,
    { dateStyle: "medium" }
  )

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <div>{backLink}</div>

      <section
        aria-labelledby="japanese-article-title"
        className="mt-4 border-b border-border/60 pb-5"
      >
        <h1
          className="font-script-ja text-2xl font-semibold tracking-tight"
          id="japanese-article-title"
          lang="ja"
        >
          {article.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span>{createdAt}</span>
          <span aria-hidden="true">·</span>
          <span>
            {t("japanese.library.articleMeta", {
              sentences: article.sentenceCount,
              words: article.wordCount
            })}
          </span>
          {article.sourceUrl ? (
            <>
              <span aria-hidden="true">·</span>
              <a
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                href={article.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("japanese.library.article.source")}
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3"
                  icon={ArrowUpRight01Icon}
                />
              </a>
            </>
          ) : null}
          {isAnalyzed ? (
            <>
              <span aria-hidden="true">·</span>
              <button
                className="font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:opacity-60"
                disabled={reanalyze.isPending}
                onClick={() => reanalyze.mutate()}
                type="button"
              >
                {reanalyze.isPending
                  ? t("japanese.library.article.analyzing")
                  : t("japanese.library.article.reanalyze")}
              </button>
            </>
          ) : null}
        </div>
      </section>

      {hasAnalysis ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <UnitSelector onChange={setUnit} unit={unit} />
          <ReadingDisplayToggles
            onToggleFurigana={() => setShowFurigana((value) => !value)}
            onToggleRomaji={() => setShowRomaji((value) => !value)}
            showFurigana={showFurigana}
            showRomaji={showRomaji}
          />
          <JapanesePosLegend
            enabledPosCategories={enabledPosCategories}
            onToggle={handleToggle}
          />
          {analyzedInBrowser && <JapaneseBrowserEngineBadge />}
        </div>
      ) : null}
      {isAnalyzed ? null : (
        <div className="mt-5 space-y-3">
          <PendingAnalysisNotice
            error={reanalyze.error}
            isAnalyzing={reanalyze.isPending}
            onAnalyze={() => reanalyze.mutate()}
          />
          <JapaneseBrowserEngineBanner
            engine={engine}
            onEnable={() => {
              void enableBrowserEngine().catch(() => {
                // The banner shows engine.error; nothing else to do here.
              })
            }}
            serverUnavailable={serverUnavailable}
          />
          {analyzedInBrowser && (
            <p className="text-xs text-muted-foreground">
              {t("japanese.engine.web.notSaved")}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {paragraphs.map((paragraph) => (
            <div className="flex flex-col gap-3" key={paragraph.id}>
              {paragraph.sentences.map((sentence) =>
                sentence.analysis ? (
                  <JapaneseAnalyzedSentenceView
                    analysis={sentence.analysis}
                    enabledPosCategories={enabledPosCategories}
                    key={sentence.id}
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
                ) : (
                  <p
                    className="font-script-ja text-2xl leading-relaxed"
                    key={sentence.id}
                    lang="ja"
                  >
                    {sentence.text}
                  </p>
                )
              )}
            </div>
          ))}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {selectedWord && selectedSentence?.analysis ? (
            <SelectedWordPanel
              analysis={selectedSentence.analysis}
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
