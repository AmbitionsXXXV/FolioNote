import { Button } from "@heroui/react"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

type SyncStatus =
  | "up_to_date"
  | "source_changed"
  | "conflict"
  | "error"
  | "not_tracked"

const STATUS_DOT: Record<SyncStatus, string> = {
  up_to_date: "bg-emerald-500",
  source_changed: "bg-sky-500",
  conflict: "bg-accent",
  error: "bg-danger",
  not_tracked: "bg-muted"
}

export function SyncStatusLabel({ status }: { status: SyncStatus }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
      />
      {t(`imports.status.${status}`)}
    </span>
  )
}

/**
 * Where an imported entry came from, and — in watch mode — whether the
 * source moved on. Opening the entry runs one check so the status is fresh.
 */
export function EntrySourceStatus({ entryId }: { entryId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const linkQuery = orpc.imports.linkForEntry.queryOptions({
    input: { entryId }
  })
  const link = useQuery(linkQuery)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.imports.key() })
  }
  const check = useMutation(
    orpc.imports.checkLink.mutationOptions({
      onSuccess: (updated) =>
        queryClient.setQueryData(linkQuery.queryKey, updated)
    })
  )
  const reimport = useMutation(
    orpc.imports.reimport.mutationOptions({
      onSuccess: async () => {
        setConfirmOpen(false)
        await queryClient.invalidateQueries({ queryKey: orpc.entries.key() })
        await refresh()
        toast.success(t("imports.reimported"))
      },
      onError: (error) => toast.error(error.message)
    })
  )

  const isWatching = link.data?.mode === "watch"
  const { mutate: runCheck } = check
  useEffect(() => {
    if (isWatching) {
      runCheck({ entryId })
    }
  }, [entryId, isWatching, runCheck])

  if (!link.data) {
    return null
  }
  const { provider, url, status } = link.data
  const canReimport =
    provider === "notion" || provider === "google_docs" || provider === "web"

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {url ? (
        <a
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface/40 px-2 py-0.5 hover:bg-surface-secondary"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t(`imports.providers.${provider}`)}
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3"
            icon={ArrowUpRight01Icon}
          />
        </a>
      ) : (
        <span>{t(`imports.providers.${provider}`)}</span>
      )}
      <span className="text-muted-foreground">
        {isWatching ? (
          <SyncStatusLabel status={status} />
        ) : (
          t("imports.mode.snapshot")
        )}
      </span>
      {isWatching && status === "source_changed" && canReimport ? (
        <Button
          onPress={() => setConfirmOpen(true)}
          size="sm"
          variant="secondary"
        >
          {t("imports.reimport")}
        </Button>
      ) : null}
      {!isWatching && canReimport ? (
        <Button onPress={() => setConfirmOpen(true)} size="sm" variant="ghost">
          {t("imports.reimport")}
        </Button>
      ) : null}
      <ConfirmDeleteDialog
        confirmText={t("imports.reimport")}
        description={t("imports.reimportConfirm")}
        onConfirm={() => reimport.mutate({ entryId })}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t("imports.reimportTitle")}
      />
    </div>
  )
}
