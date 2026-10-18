import { Skeleton } from "@folionote/ui/skeleton"
import { Button, SearchField } from "@heroui/react"
import {
  ArrowRight01Icon,
  Book02Icon,
  BookOpen01Icon,
  Delete02Icon,
  Quiz01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { JapaneseAttribution } from "@/components/japanese/japanese-attribution"
import { JapaneseSearchResults } from "@/components/japanese/japanese-search-results"
import { useBrowserJapanese } from "@/hooks/use-browser-japanese"
import { useDebounce } from "@/hooks/use-debounce"
import { removeBrowserDictionary } from "@/lib/japanese/browser-engine"
import { searchQuerySchema } from "@/lib/search-schemas"
import { orpc } from "@/utils/orpc"

export const Route = createFileRoute("/_app/japanese/")({
  component: JapaneseHubPage,
  validateSearch: searchQuerySchema
})

const SEARCH_DEBOUNCE_MS = 200
const SEARCH_LIMIT = 20
const LEVELS_STALE_MS = 5 * 60 * 1000
const EXAMPLE_QUERIES = ["たべる", "taberu", "食", "てみる", "eat"]
const DESKTOP_MEDIA_QUERY = "(min-width: 768px)"
const BYTES_PER_MB = 1_000_000
const VERSION_LABEL_LENGTH = 6

const CARD_CLASS =
  "group flex items-start gap-4 rounded-3xl border border-border/60 bg-card/70 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

function LevelTiles() {
  const { t } = useTranslation()
  const { data, isPending } = useQuery({
    ...orpc.japanese.levels.queryOptions(),
    staleTime: LEVELS_STALE_MS
  })

  return (
    <section>
      <h2 className="font-display text-lg font-semibold">
        {t("japanese.search.levelsTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("japanese.search.levelsNote")}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {isPending || !data
          ? ["N5", "N4", "N3", "N2", "N1"].map((level) => (
              <Skeleton className="h-24 rounded-2xl" key={level} />
            ))
          : data.map((level) => (
              <div
                className="rounded-2xl border border-border/60 bg-card/50 p-4"
                key={level.level}
              >
                <dt className="font-display text-xl font-semibold text-primary">
                  {level.level}
                </dt>
                <dd className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <p>
                    {t("japanese.search.levelWords", { count: level.words })}
                  </p>
                  <p>
                    {t("japanese.search.levelKanji", { count: level.kanji })}
                  </p>
                  <p>
                    {t("japanese.search.levelGrammar", {
                      count: level.grammar
                    })}
                  </p>
                </dd>
              </div>
            ))}
      </dl>
    </section>
  )
}

/** One quiet card: how much the reader has imported, plus the two ways in. */
function LibraryCard() {
  const { t } = useTranslation()
  const articles = useQuery({
    ...orpc.japanese.articles.list.queryOptions(),
    staleTime: LEVELS_STALE_MS,
    meta: { silentError: true }
  })
  const lexicons = useQuery({
    ...orpc.japanese.lexicons.list.queryOptions(),
    staleTime: LEVELS_STALE_MS,
    meta: { silentError: true }
  })
  const articleCount = articles.data?.length
  const listCount = lexicons.data?.length
  const isEmpty = articleCount === 0 && listCount === 0

  let summary: ReactNode = <Skeleton className="mt-1 h-4 w-40" />
  if (articleCount !== undefined && listCount !== undefined) {
    summary = isEmpty
      ? t("japanese.library.hub.empty")
      : t("japanese.library.hub.counts", {
          articles: t("japanese.library.hub.articleCount", {
            count: articleCount
          }),
          lists: t("japanese.library.hub.listCount", { count: listCount })
        })
  }

  return (
    <div className={CARD_CLASS}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
        <HugeiconsIcon className="size-5 text-primary" icon={Book02Icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display text-base font-semibold">
          {t("japanese.library.hub.title")}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {summary}
        </span>
        <span className="mt-3 flex flex-wrap gap-2">
          <Link
            className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-primary/20 transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            search={{ type: "article" }}
            to="/japanese/import"
          >
            {t("japanese.library.hub.import")}
          </Link>
          <Link
            className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            to="/japanese/library"
          >
            {t("japanese.library.hub.open")}
          </Link>
        </span>
      </span>
    </div>
  )
}

/**
 * The dictionary this browser downloaded for offline analysis, with removal.
 * Appears only once a download has completed; the reading pages offer it.
 */
function BrowserDictionaryStatus() {
  const { t } = useTranslation()
  const engine = useBrowserJapanese()
  const { dictionary, metrics } = engine
  if (!dictionary) return null
  const isBusy = engine.status === "downloading" || engine.status === "building"
  const devMetrics = import.meta.env.DEV
    ? Object.entries(metrics)
        .map(([key, value]) =>
          key === "workerHeapBytes"
            ? `${key} ${Math.round(value / BYTES_PER_MB)}MB`
            : `${key} ${value}ms`
        )
        .join(" · ")
    : ""

  return (
    <section
      aria-labelledby="japanese-browser-dictionary-title"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-3"
    >
      <div className="min-w-0 space-y-0.5">
        <h2
          className="text-sm font-medium"
          id="japanese-browser-dictionary-title"
        >
          {t("japanese.engine.web.statusTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("japanese.engine.web.statusDownloaded", {
            size: Math.round(dictionary.bytes / BYTES_PER_MB),
            version: dictionary.version.slice(0, VERSION_LABEL_LENGTH)
          })}
        </p>
        {devMetrics.length > 0 && (
          <p className="text-[11px] text-muted-foreground/80">{devMetrics}</p>
        )}
      </div>
      <Button
        isDisabled={isBusy}
        onPress={() => {
          void removeBrowserDictionary()
        }}
        size="sm"
        variant="danger-soft"
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4"
          icon={Delete02Icon}
        />
        {t("japanese.engine.remove")}
      </Button>
    </section>
  )
}

function HubHome({
  onPickExample
}: {
  onPickExample: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t("japanese.search.tryLabel")}
        </span>
        {EXAMPLE_QUERIES.map((example) => (
          <button
            className="rounded-full bg-surface-secondary px-3 py-1 font-medium transition-colors hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            key={example}
            lang="ja"
            onClick={() => onPickExample(example)}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>

      <LevelTiles />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link className={CARD_CLASS} to="/japanese/read">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon
              className="size-5 text-primary"
              icon={BookOpen01Icon}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-base font-semibold">
                {t("japanese.search.readingTitle")}
              </span>
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                icon={ArrowRight01Icon}
              />
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("japanese.search.readingDescription")}
            </span>
          </span>
        </Link>

        <div className={CARD_CLASS}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon className="size-5 text-primary" icon={Quiz01Icon} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-base font-semibold">
              {t("japanese.search.practiceTitle")}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("japanese.search.practiceDescription")}
            </span>
            <span className="mt-3 flex flex-wrap gap-2">
              <Link
                className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-primary/20 transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                to="/japanese/practice/exam"
              >
                {t("japanese.search.practiceExam")}
              </Link>
              <Link
                className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                to="/japanese/practice/vocab"
              >
                {t("japanese.search.practiceVocab")}
              </Link>
            </span>
          </span>
        </div>

        <LibraryCard />
      </div>

      <BrowserDictionaryStatus />
    </div>
  )
}

function JapaneseHubPage() {
  const { t } = useTranslation()
  const navigate = useNavigate({ from: "/japanese" })
  const { q } = Route.useSearch()
  const [input, setInput] = useState(q)
  const debouncedInput = useDebounce(input, SEARCH_DEBOUNCE_MS)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the field in sync when the URL changes from outside (chip, back
  // button) without clobbering keystrokes the debounce has not pushed yet.
  const [previousQ, setPreviousQ] = useState(q)
  if (q !== previousQ) {
    setPreviousQ(q)
    if (q !== debouncedInput) {
      setInput(q)
    }
  }

  useEffect(() => {
    if (debouncedInput !== q) {
      void navigate({ search: { q: debouncedInput }, replace: true })
    }
  }, [debouncedInput, navigate, q])

  useEffect(() => {
    if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      inputRef.current?.focus()
    }
  }, [])

  const trimmedQuery = q.trim()
  const hasQuery = trimmedQuery.length > 0
  const search = useQuery({
    ...orpc.japanese.search.queryOptions({
      input: { query: trimmedQuery, limit: SEARCH_LIMIT }
    }),
    enabled: hasQuery,
    placeholderData: keepPreviousData
  })

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-10 pb-16">
      <header className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {t("japanese.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("japanese.description")}
        </p>
        <SearchField
          aria-label={t("japanese.search.label")}
          className="mx-auto mt-6 w-full"
          onChange={setInput}
          value={input}
        >
          <SearchField.Group className="h-14 rounded-2xl text-base">
            <SearchField.SearchIcon />
            <SearchField.Input
              lang="ja"
              placeholder={t("japanese.search.placeholder")}
              ref={inputRef}
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </header>

      {hasQuery ? (
        <JapaneseSearchResults
          data={search.data}
          isPending={search.isPending}
          query={trimmedQuery}
        />
      ) : (
        <HubHome onPickExample={setInput} />
      )}

      <JapaneseAttribution />
    </div>
  )
}
