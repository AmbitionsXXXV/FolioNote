import { Button, Modal } from "@heroui/react"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { cn } from "@/lib/utils"
import type { client } from "@/utils/orpc"
import { orpc } from "@/utils/orpc"

/** checkLink / syncNow / resolveConflict all return the link + this flag. */
type LinkResult = Awaited<ReturnType<typeof client.imports.checkLink>>

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

interface NodeJson {
  type: string
  text?: string
  content?: NodeJson[]
}

/** Plain text of a block, for the side-by-side conflict view. */
function blockText(node: NodeJson): string {
  if (node.text) return node.text
  return (node.content ?? [])
    .map(blockText)
    .join(node.type === "doc" ? "\n" : "")
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

interface ConflictReviewProps {
  entryId: string
  conflicts: { key: string; local: NodeJson; incoming: NodeJson }[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onResolved: (contentChanged: boolean) => Promise<void>
}

/** Blocks changed both here and in Notion: pick a side, one at a time. */
function ConflictReview({
  entryId,
  conflicts,
  isOpen,
  onOpenChange,
  onResolved
}: ConflictReviewProps) {
  const { t } = useTranslation()
  const resolve = useMutation(
    orpc.imports.resolveConflict.mutationOptions({
      onSuccess: (result) => {
        onResolved(result.contentChanged)
        if (!result.conflicts?.length) onOpenChange(false)
      },
      onError: (error) => toast.error(error.message)
    })
  )
  const [current] = conflicts

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {t("imports.conflicts.title", { count: conflicts.length })}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-muted-foreground">
              {t("imports.conflicts.description")}
            </p>
            {current ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <section className="rounded-[10px] bg-surface-secondary p-3">
                  <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("imports.conflicts.mine")}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" lang="ja">
                    {blockText(current.local)}
                  </p>
                </section>
                <section className="rounded-[10px] bg-surface-secondary p-3">
                  <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("imports.conflicts.source")}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap" lang="ja">
                    {blockText(current.incoming)}
                  </p>
                </section>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button
              isDisabled={!current || resolve.isPending}
              onPress={() =>
                current &&
                resolve.mutate({ entryId, key: current.key, choice: "mine" })
              }
              variant="ghost"
            >
              {t("imports.conflicts.keepMine")}
            </Button>
            <Button
              isDisabled={!current || resolve.isPending}
              onPress={() =>
                current &&
                resolve.mutate({ entryId, key: current.key, choice: "source" })
              }
              variant="primary"
            >
              {t("imports.conflicts.useSource")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

/**
 * Where an imported entry came from and how it follows the source. Opening
 * the entry runs one check: watch mode flags changes, pull mode merges them
 * in. When the content was rewritten, `onContentReplaced` lets the page
 * drop its local copy so the editor shows the merged version.
 */
export function EntrySourceStatus({
  entryId,
  onContentReplaced
}: {
  entryId: string
  onContentReplaced: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const linkQuery = orpc.imports.linkForEntry.queryOptions({
    input: { entryId }
  })
  const link = useQuery(linkQuery)

  const afterContentChange = async () => {
    // The entry page caches the entry under ["entries", id] (not an oRPC key).
    await queryClient.invalidateQueries({ queryKey: ["entries", entryId] })
    onContentReplaced()
  }
  const applyResult = async (result: LinkResult): Promise<void> => {
    queryClient.setQueryData(linkQuery.queryKey, result)
    if (result.contentChanged) {
      await afterContentChange()
      toast.success(t("imports.pulled"))
    }
  }
  const check = useMutation(
    orpc.imports.checkLink.mutationOptions({ onSuccess: applyResult })
  )
  const syncNow = useMutation(
    orpc.imports.syncNow.mutationOptions({
      onSuccess: applyResult,
      onError: (error) => toast.error(error.message)
    })
  )
  const reimport = useMutation(
    orpc.imports.reimport.mutationOptions({
      onSuccess: async () => {
        setConfirmOpen(false)
        await queryClient.invalidateQueries({ queryKey: orpc.imports.key() })
        await afterContentChange()
        toast.success(t("imports.reimported"))
      },
      onError: (error) => toast.error(error.message)
    })
  )

  const mode = link.data?.mode
  const isFollowing = mode === "watch" || mode === "pull"
  const { mutate: runCheck } = check
  useEffect(() => {
    if (isFollowing) {
      runCheck({ entryId })
    }
  }, [entryId, isFollowing, runCheck])

  if (!link.data) {
    return null
  }
  const { provider, url, status, conflicts } = link.data
  const canReimport =
    mode !== "pull" &&
    (provider === "notion" || provider === "google_docs" || provider === "web")
  const pendingConflicts = conflicts ?? []

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {url ? (
        <a
          className="inline-flex items-center gap-1.5 rounded-md bg-surface-secondary px-2 py-0.5 hover:bg-surface-tertiary"
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
        {isFollowing ? (
          <SyncStatusLabel status={status} />
        ) : (
          t("imports.mode.snapshot")
        )}
      </span>
      {mode === "pull" && pendingConflicts.length > 0 ? (
        <Button onPress={() => setReviewOpen(true)} size="sm" variant="primary">
          {t("imports.conflicts.review", { count: pendingConflicts.length })}
        </Button>
      ) : null}
      {mode === "pull" ? (
        <Button
          isPending={syncNow.isPending || check.isPending}
          onPress={() => syncNow.mutate({ entryId })}
          size="sm"
          variant="ghost"
        >
          {t("imports.syncNow")}
        </Button>
      ) : null}
      {mode === "watch" && status === "source_changed" && canReimport ? (
        <Button
          onPress={() => setConfirmOpen(true)}
          size="sm"
          variant="secondary"
        >
          {t("imports.reimport")}
        </Button>
      ) : null}
      {mode === "snapshot" && canReimport ? (
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
      <ConflictReview
        conflicts={pendingConflicts}
        entryId={entryId}
        isOpen={reviewOpen}
        onOpenChange={setReviewOpen}
        onResolved={async (contentChanged) => {
          await link.refetch()
          if (contentChanged) await afterContentChange()
        }}
      />
    </div>
  )
}
