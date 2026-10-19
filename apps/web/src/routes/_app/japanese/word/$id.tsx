import { alignRuby } from "@folionote/japanese"
import { Skeleton } from "@folionote/ui/skeleton"
import { Chip } from "@heroui/react"
import { ArrowLeft01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { JapaneseAttribution } from "@/components/japanese/japanese-attribution"
import { JapaneseLevelChip } from "@/components/japanese/japanese-level-chip"
import { JapaneseRuby } from "@/components/japanese/japanese-ruby"
import { parseFuriganaMarkup } from "@/lib/japanese-furigana"
import { jmdictPosLabelKey } from "@/lib/japanese-jmdict-pos"
import { orpc } from "@/utils/orpc"

const wordSearchSchema = z.object({
  /** Search the reader came from, so "Back" restores it. */
  q: z.string().optional().catch(undefined)
})

export const Route = createFileRoute("/_app/japanese/word/$id")({
  component: JapaneseWordPage,
  validateSearch: wordSearchSchema
})

const TATOEBA_SENTENCE_URL = "https://tatoeba.org/sentences/show/"
const EXTERNAL_LINK_CLASS =
  "inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

function PosChips({ codes }: { codes: string[] }) {
  const { t } = useTranslation()
  if (codes.length === 0) {
    return null
  }
  return (
    <>
      {codes.map((code) => {
        const key = jmdictPosLabelKey(code)
        return (
          <Chip key={code} size="sm" variant="soft">
            {key ? t(key) : code}
          </Chip>
        )
      })}
    </>
  )
}

function WordPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

function JapaneseWordPage() {
  const { i18n, t } = useTranslation()
  const { id } = Route.useParams()
  const { q } = Route.useSearch()
  const { data, isPending, isError } = useQuery({
    ...orpc.japanese.word.queryOptions({ input: { id } }),
    retry: false
  })

  const backLink = (
    <Link
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      search={{ q: q ?? "" }}
      to="/japanese"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-4"
        icon={ArrowLeft01Icon}
      />
      {t("japanese.word.backToSearch")}
    </Link>
  )

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[800px] pb-16">
        {backLink}
        <div className="mt-6">
          <WordPageSkeleton />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-[800px] pb-16">
        {backLink}
        <div className="mt-10 text-center">
          <h1 className="font-display text-2xl font-semibold">
            {t("japanese.word.notFound")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("japanese.word.notFoundHint")}
          </p>
        </div>
      </div>
    )
  }

  const { word, examples, kanji } = data
  const headword = alignRuby(word.word, word.reading) ?? [{ text: word.word }]
  const wantsChinese = (i18n.resolvedLanguage ?? i18n.language).startsWith("zh")
  const preferred = word.meaningsZh ?? word.meaningsEn
  // Some MOJi words only carry Japanese definitions.
  const meanings =
    preferred.length > 0 ? preferred : (word.meaningsJa ?? preferred)
  const showChineseNote = wantsChinese && word.meaningsZh === null

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-10 pb-16">
      <div>{backLink}</div>

      <header>
        <h1
          className="font-script-ja text-5xl leading-[1.6] font-semibold tracking-tight md:text-6xl"
          lang="ja"
        >
          <JapaneseRuby segments={headword} />
        </h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-muted-foreground">
          {word.reading !== word.word ? (
            <span lang="ja">{word.reading}</span>
          ) : null}
          <span className="font-mono text-sm">{word.romaji}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <JapaneseLevelChip approximate level={word.level} />
          <PosChips codes={word.jmdictPos} />
        </div>
      </header>

      <section aria-labelledby="japanese-word-meanings">
        <h2
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          id="japanese-word-meanings"
        >
          {t("japanese.word.meanings")}
        </h2>
        {showChineseNote ? (
          <p className="mt-2 text-xs text-muted-foreground/80">
            {t("japanese.word.zhUnavailable")}
          </p>
        ) : null}
        <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-base marker:text-muted-foreground/60">
          {meanings.map((meaning) => (
            <li key={meaning}>{meaning}</li>
          ))}
        </ol>
      </section>

      {examples.length > 0 ? (
        <section aria-labelledby="japanese-word-examples">
          <h2
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            id="japanese-word-examples"
          >
            {t("japanese.word.examples")}
          </h2>
          <ul className="mt-3 divide-y divide-border/40">
            {examples.map((example) => (
              <li className="py-4" key={example.ja}>
                <p className="font-script-ja text-xl leading-[1.9]" lang="ja">
                  {example.furigana ? (
                    <JapaneseRuby
                      segments={parseFuriganaMarkup(example.furigana)}
                    />
                  ) : (
                    example.ja
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {wantsChinese
                    ? (example.zh ?? example.en)
                    : (example.en ?? example.zh)}
                </p>
                {example.tatoebaId !== null ? (
                  <a
                    className={`${EXTERNAL_LINK_CLASS} mt-1.5`}
                    href={`${TATOEBA_SENTENCE_URL}${example.tatoebaId}`}
                    rel="noopener"
                    target="_blank"
                  >
                    {t("japanese.word.tatoeba")}
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-3"
                      icon={ArrowUpRight01Icon}
                    />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {kanji.length > 0 ? (
        <section aria-labelledby="japanese-word-kanji">
          <h2
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            id="japanese-word-kanji"
          >
            {t("japanese.word.kanji")}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {kanji.map((entry) => (
              <article
                className="rounded-3xl border border-border/60 bg-card/60 p-5"
                key={entry.character}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="font-script-ja text-5xl leading-none font-semibold"
                    lang="ja"
                  >
                    {entry.character}
                  </span>
                  <JapaneseLevelChip level={entry.level} />
                </div>
                <p className="mt-3 text-sm">{entry.meaningsEn.join(", ")}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  {entry.onyomi.length > 0 ? (
                    <div className="flex gap-2">
                      <dt className="w-10 shrink-0 text-muted-foreground">
                        {t("japanese.word.onyomi")}
                      </dt>
                      <dd lang="ja">{entry.onyomi.join("、")}</dd>
                    </div>
                  ) : null}
                  {entry.kunyomi.length > 0 ? (
                    <div className="flex gap-2">
                      <dt className="w-10 shrink-0 text-muted-foreground">
                        {t("japanese.word.kunyomi")}
                      </dt>
                      <dd lang="ja">{entry.kunyomi.join("、")}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-3 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {entry.strokes !== null ? (
                    <span>
                      {t("japanese.word.strokes", { count: entry.strokes })}
                    </span>
                  ) : null}
                  {entry.grade !== null ? (
                    <span>
                      {t("japanese.word.grade", { grade: entry.grade })}
                    </span>
                  ) : null}
                </p>
                {entry.words.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="text-[11px] text-muted-foreground">
                      {t("japanese.word.kanjiWords")}
                    </h3>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.words.map((related) => (
                        <li key={related}>
                          <Link
                            className="rounded-full bg-surface-secondary px-2.5 py-0.5 font-script-ja text-sm transition-colors hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                            lang="ja"
                            search={{ q: related }}
                            to="/japanese"
                          >
                            {related}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <JapaneseAttribution />
    </div>
  )
}
