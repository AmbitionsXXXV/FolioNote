import { Button } from "@folionote/ui/button"
import {
  AlertCircleIcon,
  Loading02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Entry } from "@/types"
import { orpc } from "@/utils/orpc"

import { ConfirmDeleteDialog } from "./confirm-delete-dialog"
import { EntryCard } from "./entry-card"

// 骨架屏的稳定 ID
const SKELETON_IDS = [
  "skeleton-a",
  "skeleton-b",
  "skeleton-c",
  "skeleton-d",
  "skeleton-e",
  "skeleton-f"
] as const

interface EntryListProps {
  entries: Entry[]
  isLoading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  emptyMessage?: string
  errorMessage?: string
  onRetry?: () => void
}

/**
 * Renders a list of entries with support for pinned ordering, loading and empty states, and an optional "load more" control.
 *
 * @returns A React element containing the entries grid, including pinned and regular sections, skeletons for loading, an empty message when there are no entries, and an optional load-more button.
 */
export function EntryList({
  entries,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  emptyMessage,
  errorMessage,
  onRetry
}: EntryListProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const resolvedEmptyMessage = emptyMessage ?? t("entry.empty")

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null)

  // Update entry mutation (for star/pin actions)
  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string
      isStarred?: boolean
      isPinned?: boolean
    }) => orpc.entries.update.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] })
    }
  })

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: (data: { id: string }) => orpc.entries.delete.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] })
      setDeleteDialogOpen(false)
      setEntryToDelete(null)
    }
  })

  const handleStar = (entry: Entry) => {
    updateMutation.mutate({
      id: entry.id,
      isStarred: !entry.isStarred
    })
  }

  const handlePin = (entry: Entry) => {
    updateMutation.mutate({
      id: entry.id,
      isPinned: !entry.isPinned
    })
  }

  const handleDeleteClick = (entry: Entry) => {
    setEntryToDelete(entry)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (entryToDelete) {
      deleteMutation.mutate({ id: entryToDelete.id })
    }
  }

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label={t("common.loading")}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
      >
        {SKELETON_IDS.map((id) => (
          <div
            className="rounded-lg border border-border/50 bg-card p-4"
            key={id}
          >
            <div className="mb-3 h-5 w-3/4 rounded bg-surface-secondary" />
            <div className="mb-2 h-4 w-full rounded bg-surface-secondary/60" />
            <div className="mb-3 h-4 w-2/3 rounded bg-surface-secondary/40" />
            <div className="h-3 w-1/4 rounded bg-surface-secondary/30" />
          </div>
        ))}
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div
        aria-live="polite"
        className="flex flex-col items-center justify-center py-12 text-center"
        role="alert"
      >
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <HugeiconsIcon
            className="size-8 text-destructive"
            icon={AlertCircleIcon}
          />
        </div>
        <p className="mb-2 font-semibold text-foreground">
          {t("common.loadFailed")}
        </p>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">
          {errorMessage}
        </p>
        {onRetry ? (
          <Button className="min-w-[120px]" onClick={onRetry} variant="outline">
            {t("common.retry")}
          </Button>
        ) : null}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        role="status"
      >
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-surface-secondary/50">
          <svg
            aria-hidden="true"
            className="size-8 text-muted-foreground/60"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="font-medium text-foreground">{resolvedEmptyMessage}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("entry.startWriting")}
        </p>
      </div>
    )
  }

  // Separate pinned entries to show them first
  const pinnedEntries = entries.filter((e) => e.isPinned)
  const regularEntries = entries.filter((e) => !e.isPinned)

  return (
    <div aria-busy={isLoadingMore} className="space-y-6" role="feed">
      {/* Pinned entries section */}
      {pinnedEntries.length > 0 ? (
        <section aria-label={t("entry.pinnedSection")} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-primary" />
            {t("entry.pinnedSection")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedEntries.map((entry) => (
              <EntryCard
                contentText={entry.contentText}
                id={entry.id}
                isPinned={entry.isPinned}
                isStarred={entry.isStarred}
                key={entry.id}
                onDelete={() => handleDeleteClick(entry)}
                onPin={() => handlePin(entry)}
                onStar={() => handleStar(entry)}
                title={entry.title}
                updatedAt={entry.updatedAt}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Regular entries */}
      {regularEntries.length > 0 ? (
        <section aria-label={t("common.other")} className="space-y-3">
          {pinnedEntries.length > 0 ? (
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("common.other")}
            </h2>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regularEntries.map((entry) => (
              <EntryCard
                contentText={entry.contentText}
                id={entry.id}
                isPinned={entry.isPinned}
                isStarred={entry.isStarred}
                key={entry.id}
                onDelete={() => handleDeleteClick(entry)}
                onPin={() => handlePin(entry)}
                onStar={() => handleStar(entry)}
                title={entry.title}
                updatedAt={entry.updatedAt}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Load more button */}
      {hasMore && onLoadMore ? (
        <div className="flex justify-center pt-6">
          <Button
            aria-label={
              isLoadingMore ? t("common.loading") : t("common.loadMore")
            }
            className="min-w-[140px]"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            variant="outline"
          >
            {isLoadingMore ? (
              <>
                <HugeiconsIcon
                  className="mr-2 size-4 animate-spin"
                  icon={Loading02Icon}
                />
                <span>{t("common.loading")}</span>
              </>
            ) : (
              t("common.loadMore")
            )}
          </Button>
        </div>
      ) : null}

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        description={t("entry.deleteConfirmDesc")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        title={t("entry.deleteConfirmTitle")}
      />
    </div>
  )
}
