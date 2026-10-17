import type { AnalyzedText, Word } from "@folionote/japanese"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import type { LexiconMatch } from "@/hooks/use-japanese-lexicon-lookup"
import { formatLexiconTag } from "@/hooks/use-japanese-lexicon-lookup"

import { JapaneseRuby } from "./japanese-ruby"

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

/** The reader's own list entries come first: they are what they chose to learn. */
function LexiconMatches({ matches }: { matches: LexiconMatch[] }) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t("japanese.library.tags.inYourLists")}
      className="mt-3 rounded-xl bg-primary/8 px-3 py-2.5"
    >
      <h3 className="text-[11px] font-medium text-primary">
        {t("japanese.library.tags.inYourLists")}
      </h3>
      <ul className="mt-1.5 space-y-2">
        {matches.map((match) => (
          <li
            className="text-sm"
            key={`${match.lexiconId}-${match.unit ?? ""}-${match.baseForm}`}
          >
            <Link
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              params={{ lexiconId: match.lexiconId }}
              to="/japanese/lists/$lexiconId"
            >
              {formatLexiconTag(match)}
            </Link>
            {match.meanings.length > 0 ? (
              <p className="mt-0.5 leading-snug">{match.meanings.join("；")}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SelectedWordPanel({
  word,
  analysis,
  lexiconMatches = []
}: {
  word: Word
  analysis: AnalyzedText
  lexiconMatches?: LexiconMatch[]
}) {
  const { t } = useTranslation()
  const morphemes = word.morphemeIndexes
    .map((index) => analysis.morphemes[index])
    .filter((morpheme) => morpheme !== undefined)

  return (
    <div className="animate-fade-in rounded-2xl border border-border/50 bg-card/50 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-script-ja text-2xl font-semibold" lang="ja">
          <JapaneseRuby segments={word.ruby ?? [{ text: word.surface }]} />
        </span>
        {word.reading ? (
          <span className="text-sm text-muted-foreground" lang="ja">
            {word.reading}
          </span>
        ) : null}
      </div>

      {lexiconMatches.length > 0 ? (
        <LexiconMatches matches={lexiconMatches} />
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DetailField
          label={t("japanese.reading.fieldBaseForm")}
          value={word.baseForm}
        />
        <DetailField
          label={t("japanese.reading.fieldPos")}
          value={t(`review.japaneseTyping.posCategories.${word.pos}`)}
        />
        <DetailField
          label={t("japanese.reading.fieldRomaji")}
          value={word.romaji ?? "—"}
        />
        <DetailField
          label={t("japanese.reading.fieldReading")}
          value={word.reading ?? "—"}
        />
      </dl>

      <h3 className="mt-4 text-[11px] text-muted-foreground">
        {t("japanese.reading.morphemes")}
      </h3>
      <ol className="mt-1 divide-y divide-border/50 text-sm">
        {morphemes.map((morpheme) => (
          <li
            className="flex items-baseline justify-between gap-3 py-1.5"
            key={`${morpheme.start}-${morpheme.surface}`}
          >
            <span className="font-script-ja text-base" lang="ja">
              {morpheme.surface}
              {morpheme.baseForm && morpheme.baseForm !== morpheme.surface ? (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {morpheme.baseForm}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(`review.japaneseTyping.posCategories.${morpheme.learnerPos}`)}
            </span>
          </li>
        ))}
      </ol>

      <Link
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        search={{ q: word.baseForm }}
        to="/japanese"
      >
        {t("japanese.reading.lookUp", { word: word.baseForm })}
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5"
          icon={ArrowUpRight01Icon}
        />
      </Link>
    </div>
  )
}
