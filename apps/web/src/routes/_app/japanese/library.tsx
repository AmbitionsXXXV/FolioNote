import { Skeleton } from "@folionote/ui/skeleton"
import { Button, Chip } from "@heroui/react"
import {
  ArrowRight01Icon,
  Delete02Icon,
  PlusSignIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { orpc } from "@/utils/orpc"

export const Route = createFileRoute("/_app/japanese/library")({
  component: JapaneseLibraryPage
})

const ROW_CLASS =
  "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-secondary/70"
const ROW_LINK_CLASS =
  "flex min-w-0 flex-1 items-center gap-3 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

type DeleteTarget =
  | { kind: "article"; id: string; title: string }
  | { kind: "lexicon"; id: string; name: string; count: number }

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {["a", "b", "c"].map((key) => (
        <div className="flex items-center gap-3 px-3 py-3" key={key}>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="size-8 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  message,
  action,
  to
}: {
  message: string
  action: string
  to: "article" | "wordlist"
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/70 px-6 py-10 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Link
        className="rounded-full bg-primary/12 px-3.5 py-1.5 text-sm font-medium text-foreground ring-1 ring-primary/20 transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        search={{ type: to }}
        to="/japanese/import"
      >
        {action}
      </Link>
    </div>
  )
}

function Section({
  title,
  count,
  children
}: {
  title: string
  count: number | undefined
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="text-xs text-muted-foreground/70 tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function DeleteButton({
  label,
  onPress
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Button
      aria-label={label}
      className="shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
      isIconOnly
      onPress={onPress}
      size="sm"
      variant="ghost"
    >
      <HugeiconsIcon className="size-4" icon={Delete02Icon} />
    </Button>
  )
}

function JapaneseLibraryPage() {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const locale = i18n.resolvedLanguage ?? i18n.language

  const articles = useQuery(orpc.japanese.articles.list.queryOptions())
  const lexicons = useQuery(orpc.japanese.lexicons.list.queryOptions())

  const deleteArticle = useMutation({
    mutationFn: (id: string) => orpc.japanese.articles.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.japanese.articles.key() })
      toast.success(t("japanese.library.deleted"))
      setDeleteTarget(null)
    },
    onError: () => toast.error(t("japanese.library.deleteFailed"))
  })
  const deleteLexicon = useMutation({
    mutationFn: (id: string) => orpc.japanese.lexicons.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.japanese.lexicons.key() })
      toast.success(t("japanese.library.deleted"))
      setDeleteTarget(null)
    },
    onError: () => toast.error(t("japanese.library.deleteFailed"))
  })

  const formatDate = (value: string | Date) =>
    new Date(value).toLocaleDateString(locale, { dateStyle: "medium" })
  const isDeleting = deleteArticle.isPending || deleteLexicon.isPending

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-10 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("japanese.library.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("japanese.library.subtitle")}
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none sm:self-auto"
          search={{ type: "article" }}
          to="/japanese/import"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={PlusSignIcon}
          />
          {t("japanese.library.importAction")}
        </Link>
      </header>

      <Section
        count={articles.data?.length}
        title={t("japanese.library.readingTitle")}
      >
        {articles.isPending ? <ListSkeleton /> : null}
        {articles.data && articles.data.length === 0 ? (
          <EmptyState
            action={t("japanese.library.importArticle")}
            message={t("japanese.library.readingEmpty")}
            to="article"
          />
        ) : null}
        {articles.data && articles.data.length > 0 ? (
          <ul className="divide-y divide-border/40">
            {articles.data.map((article) => (
              <li className={ROW_CLASS} key={article.id}>
                <Link
                  className={ROW_LINK_CLASS}
                  params={{ articleId: article.id }}
                  to="/japanese/read/$articleId"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate font-script-ja text-base font-medium"
                      lang="ja"
                    >
                      {article.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{formatDate(article.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {article.wordCount > 0
                          ? t("japanese.library.articleMeta", {
                              sentences: article.sentenceCount,
                              words: article.wordCount
                            })
                          : t("japanese.library.notAnalyzed")}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t(`japanese.library.source.${article.sourceType}`)}
                      </span>
                    </span>
                  </span>
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                    icon={ArrowRight01Icon}
                  />
                </Link>
                <DeleteButton
                  label={t("japanese.library.deleteArticle")}
                  onPress={() =>
                    setDeleteTarget({
                      kind: "article",
                      id: article.id,
                      title: article.title
                    })
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        count={lexicons.data?.length}
        title={t("japanese.library.listsTitle")}
      >
        {lexicons.isPending ? <ListSkeleton /> : null}
        {lexicons.data && lexicons.data.length === 0 ? (
          <EmptyState
            action={t("japanese.library.importList")}
            message={t("japanese.library.listsEmpty")}
            to="wordlist"
          />
        ) : null}
        {lexicons.data && lexicons.data.length > 0 ? (
          <ul className="divide-y divide-border/40">
            {lexicons.data.map((lexicon) => (
              <li className={ROW_CLASS} key={lexicon.id}>
                <Link
                  className={ROW_LINK_CLASS}
                  params={{ lexiconId: lexicon.id }}
                  to="/japanese/lists/$lexiconId"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className="truncate font-script-ja text-base font-medium"
                        lang="ja"
                      >
                        {lexicon.name}
                      </span>
                      {lexicon.level ? (
                        <Chip color="accent" size="sm" variant="soft">
                          {lexicon.level}
                        </Chip>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
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
                    </span>
                  </span>
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                    icon={ArrowRight01Icon}
                  />
                </Link>
                <DeleteButton
                  label={t("japanese.library.deleteList")}
                  onPress={() =>
                    setDeleteTarget({
                      kind: "lexicon",
                      id: lexicon.id,
                      name: lexicon.name,
                      count: lexicon.entryCount
                    })
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <ConfirmDeleteDialog
        description={
          deleteTarget?.kind === "lexicon"
            ? t("japanese.library.deleteListDesc", {
                name: deleteTarget.name,
                count: deleteTarget.count
              })
            : t("japanese.library.deleteArticleDesc", {
                title:
                  deleteTarget?.kind === "article" ? deleteTarget.title : ""
              })
        }
        isLoading={isDeleting}
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteTarget.kind === "article") {
            deleteArticle.mutate(deleteTarget.id)
          } else {
            deleteLexicon.mutate(deleteTarget.id)
          }
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === "lexicon"
            ? t("japanese.library.deleteList")
            : t("japanese.library.deleteArticle")
        }
      />
    </div>
  )
}
