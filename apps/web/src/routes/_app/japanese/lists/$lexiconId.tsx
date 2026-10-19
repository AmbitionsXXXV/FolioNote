import { Skeleton } from "@folionote/ui/skeleton"
import { Button, Chip } from "@heroui/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useDebounce } from "@/hooks/use-debounce"
import { orpc } from "@/utils/orpc"

export const Route = createFileRoute("/_app/japanese/lists/$lexiconId")({
  component: JapaneseLexiconPage
})

const PAGE_SIZE = 50
const FILTER_DEBOUNCE_MS = 300
const BACK_LINK_CLASS =
  "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

function TableSkeleton() {
  return (
    <div className="space-y-3 px-3 py-2">
      {["a", "b", "c", "d", "e"].map((key) => (
        <div className="flex items-center gap-4" key={key}>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  )
}

function JapaneseLexiconPage() {
  const { t } = useTranslation()
  const { lexiconId } = Route.useParams()
  const [unitInput, setUnitInput] = useState("")
  const unit = useDebounce(unitInput.trim(), FILTER_DEBOUNCE_MS)

  const query = useInfiniteQuery(
    orpc.japanese.lexicons.get.infiniteOptions({
      input: (cursor: number | undefined) => ({
        id: lexiconId,
        unit: unit || undefined,
        cursor,
        limit: PAGE_SIZE
      }),
      initialPageParam: undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      retry: false,
      meta: { silentError: true }
    })
  )

  const lexicon = query.data?.pages[0]?.lexicon
  const entries = useMemo(
    () => query.data?.pages.flatMap((page) => page.entries) ?? [],
    [query.data]
  )
  const seenUnits = useMemo(
    () =>
      [
        ...new Set(
          entries
            .map((entry) => entry.unit)
            .filter((value): value is string => Boolean(value))
        )
      ].toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [entries]
  )

  const backLink = (
    <Link className={BACK_LINK_CLASS} to="/japanese/library">
      <HugeiconsIcon
        aria-hidden="true"
        className="size-4"
        icon={ArrowLeft01Icon}
      />
      {t("japanese.library.list.back")}
    </Link>
  )

  if (query.isError && !lexicon) {
    return (
      <div className="mx-auto w-full max-w-[900px] pb-16">
        {backLink}
        <div className="mt-10 text-center">
          <h1 className="font-display text-2xl font-semibold">
            {t("japanese.library.list.notFound")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("japanese.library.list.notFoundHint")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 pb-16">
      <div>{backLink}</div>

      <header>
        {lexicon ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="font-script-ja text-2xl font-semibold tracking-tight"
                lang="ja"
              >
                {lexicon.name}
              </h1>
              {lexicon.level ? (
                <Chip color="accent" size="sm" variant="soft">
                  {lexicon.level}
                </Chip>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>{t(`japanese.library.kind.${lexicon.kind}`)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {t("japanese.library.entryCount", {
                  count: lexicon.entryCount
                })}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t("japanese.library.list.meaningsIn", {
                  language: t(
                    `japanese.library.meaningLanguage.${lexicon.meaningLanguage}`
                  )
                })}
              </span>
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          {t("japanese.library.list.unitFilter")}
          <input
            className="min-h-9 w-40 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            list="japanese-lexicon-units"
            onChange={(event) => setUnitInput(event.target.value)}
            placeholder={t("japanese.library.list.unitFilterPlaceholder")}
            type="text"
            value={unitInput}
          />
          <datalist id="japanese-lexicon-units">
            {seenUnits.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>
        <p className="text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="mr-1 inline-block rounded-sm bg-primary/12 px-1 text-[10px] font-medium text-primary"
          >
            {t("japanese.library.list.engineMarker")}
          </span>
          {t("japanese.library.list.engineReading")}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead className="bg-surface-secondary/60 text-left text-[11px] font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2" scope="col">
                {t("japanese.library.list.colHeadword")}
              </th>
              <th className="px-3 py-2" scope="col">
                {t("japanese.library.list.colReading")}
              </th>
              <th className="px-3 py-2" scope="col">
                {t("japanese.library.list.colMeanings")}
              </th>
              <th className="px-3 py-2" scope="col">
                {t("japanese.library.list.colUnit")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {query.isPending ? (
              <tr>
                <td colSpan={4}>
                  <TableSkeleton />
                </td>
              </tr>
            ) : null}
            {!query.isPending && entries.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                  colSpan={4}
                >
                  {t("japanese.library.list.empty")}
                </td>
              </tr>
            ) : null}
            {entries.map((entry) => (
              <tr className="align-top" key={entry.id}>
                <td className="px-3 py-2.5">
                  <Link
                    className="font-script-ja text-base font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                    lang="ja"
                    search={{ q: entry.headword }}
                    to="/japanese"
                  >
                    {entry.headword}
                  </Link>
                  {entry.pos ? (
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {entry.pos}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-script-ja" lang="ja">
                  {entry.reading ?? (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                  {entry.readingSource === "engine" ? (
                    <span
                      className="ml-1.5 inline-block rounded-sm bg-primary/12 px-1 align-middle text-[10px] font-medium text-primary"
                      title={t("japanese.library.list.engineReading")}
                    >
                      {t("japanese.library.list.engineMarker")}
                      <span className="sr-only">
                        {" "}
                        {t("japanese.library.list.engineReading")}
                      </span>
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 leading-snug">
                  {entry.meanings.length > 0 ? (
                    entry.meanings.join("；")
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                  {entry.unit ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            isDisabled={query.isFetchingNextPage}
            onPress={() => {
              void query.fetchNextPage()
            }}
            variant="secondary"
          >
            {query.isFetchingNextPage
              ? t("common.loading")
              : t("japanese.library.list.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
