import { Skeleton } from "@folionote/ui/skeleton"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { JapaneseLevelChip } from "./japanese-level-chip"

interface WordResult {
  id: string
  word: string
  reading: string
  romaji: string
  level: string
  meaningsEn: string[]
  meaningsZh: string[] | null
}

interface KanjiResult {
  character: string
  level: string
  strokes: number | null
  meaningsEn: string[]
}

interface GrammarResult {
  id: string
  pattern: string
  level: string
  meaning: string
  formation: string
}

export interface JapaneseSearchData {
  words: WordResult[]
  kanji: KanjiResult[]
  grammar: GrammarResult[]
}

interface JapaneseSearchResultsProps {
  query: string
  data: JapaneseSearchData | undefined
  isPending: boolean
}

const ROW_CLASS =
  "flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-secondary/70 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

function ResultGroup({
  title,
  children
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-1 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3 px-3" data-testid="japanese-search-skeleton">
      {["a", "b", "c", "d"].map((key) => (
        <div className="flex items-center gap-4 py-3" key={key}>
          <Skeleton className="h-7 w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function JapaneseSearchResults({
  query,
  data,
  isPending
}: JapaneseSearchResultsProps) {
  const { t } = useTranslation()

  if (isPending || !data) {
    return <ResultsSkeleton />
  }

  const isEmpty =
    data.words.length === 0 &&
    data.kanji.length === 0 &&
    data.grammar.length === 0

  if (isEmpty) {
    return (
      <div className="px-3 py-10 text-center">
        <p className="text-base font-medium">
          {t("japanese.search.noResults", { query })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("japanese.search.noResultsHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {data.words.length > 0 ? (
        <ResultGroup title={t("japanese.search.resultsWords")}>
          <ul className="divide-y divide-border/40">
            {data.words.map((word) => (
              <li key={word.id}>
                <Link
                  className={ROW_CLASS}
                  params={{ id: word.id }}
                  search={{ q: query }}
                  to="/japanese/word/$id"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className="font-script-ja text-xl font-semibold"
                        lang="ja"
                      >
                        {word.word}
                      </span>
                      {word.reading !== word.word ? (
                        <span
                          className="text-sm text-muted-foreground"
                          lang="ja"
                        >
                          {word.reading}
                        </span>
                      ) : null}
                      <span className="font-mono text-xs text-muted-foreground/80">
                        {word.romaji}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {word.meaningsZh?.[0] ?? word.meaningsEn[0]}
                    </span>
                  </span>
                  <JapaneseLevelChip level={word.level} />
                </Link>
              </li>
            ))}
          </ul>
        </ResultGroup>
      ) : null}

      {data.kanji.length > 0 ? (
        <ResultGroup title={t("japanese.search.resultsKanji")}>
          <ul className="divide-y divide-border/40">
            {data.kanji.map((kanji) => (
              <li className={ROW_CLASS} key={kanji.character}>
                <span
                  className="w-12 shrink-0 font-script-ja text-3xl font-semibold"
                  lang="ja"
                >
                  {kanji.character}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    {kanji.meaningsEn.join(", ")}
                  </span>
                  {kanji.strokes !== null ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("japanese.search.strokes", { count: kanji.strokes })}
                    </span>
                  ) : null}
                </span>
                <JapaneseLevelChip level={kanji.level} />
              </li>
            ))}
          </ul>
        </ResultGroup>
      ) : null}

      {data.grammar.length > 0 ? (
        <ResultGroup title={t("japanese.search.resultsGrammar")}>
          <ul className="divide-y divide-border/40">
            {data.grammar.map((grammar) => (
              <li className={ROW_CLASS} key={grammar.id}>
                <span className="min-w-0 flex-1">
                  <span
                    className="block font-script-ja text-lg font-semibold"
                    lang="ja"
                  >
                    {grammar.pattern}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {grammar.meaning}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground/80">
                    <span className="font-medium">
                      {t("japanese.search.formation")}:
                    </span>{" "}
                    <span lang="ja">{grammar.formation}</span>
                  </span>
                </span>
                <JapaneseLevelChip level={grammar.level} />
              </li>
            ))}
          </ul>
        </ResultGroup>
      ) : null}
    </div>
  )
}
