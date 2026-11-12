import { Button } from "@folionote/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@folionote/ui/dialog"
import { Input } from "@folionote/ui/input"
import { Label } from "@folionote/ui/label"
import { Skeleton } from "@folionote/ui/skeleton"
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  Tag01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { Reveal } from "@/components/reveal"
import { Surface } from "@/components/surface"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

interface Tag {
  id: string
  name: string
  color: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e"
]

export const Route = createFileRoute("/_app/tags")({
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData({
      queryKey: ["tags"],
      queryFn: () => orpc.tags.list.call({})
    })
  },
  component: TagsPage
})

function getSubmitLabel(editing: Tag | null, t: (key: string) => string) {
  if (editing) {
    return t("common.save")
  }
  return t("common.create")
}

function TagsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [tagName, setTagName] = useState("")
  const [tagColor, setTagColor] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const {
    data: tagsData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["tags"],
    queryFn: () => orpc.tags.list.call({})
  })
  const tags = tagsData ?? []

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      orpc.tags.create.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success(t("tag.created"))
      handleCloseDialog()
    },
    onError: (mutationError: Error) => {
      if (mutationError.message.includes("already exists")) {
        toast.error(t("tag.nameExists"))
      } else {
        toast.error(t("tag.createFailed"))
      }
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name?: string; color?: string | null }) =>
      orpc.tags.update.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success(t("tag.updated"))
      handleCloseDialog()
    },
    onError: (mutationError: Error) => {
      if (mutationError.message.includes("already exists")) {
        toast.error(t("tag.nameExists"))
      } else {
        toast.error(t("tag.updateFailed"))
      }
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.tags.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success(t("tag.deleted"))
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error(t("tag.deleteFailed"))
    }
  })

  const handleOpenCreate = () => {
    setEditingTag(null)
    setTagName("")
    setTagColor(
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] ?? null
    )
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag)
    setTagName(tag.name)
    setTagColor(tag.color)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingTag(null)
    setTagName("")
    setTagColor(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = tagName.trim()
    if (!trimmedName) {
      return
    }

    if (editingTag) {
      updateMutation.mutate({
        id: editingTag.id,
        name: trimmedName,
        color: tagColor
      })
    } else {
      createMutation.mutate({
        name: trimmedName,
        color: tagColor ?? undefined
      })
    }
  }

  const handleDeleteClick = useCallback((tag: Tag) => {
    setDeleteTarget(tag)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <PageContainer width="default">
      {/* Header */}
      <PageHeader
        actions={
          <Button onClick={handleOpenCreate}>
            <HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
            {t("tag.newTag")}
          </Button>
        }
        description={
          tags.length > 0
            ? `${String(tags.length)} ${t("tag.tags").toLowerCase()}`
            : t("tag.noTags")
        }
        icon={Tag01Icon}
        title={t("tag.tags")}
      />

      {/* Tag list */}
      <TagListContent
        error={error}
        handleDelete={handleDeleteClick}
        handleOpenCreate={handleOpenCreate}
        handleOpenEdit={handleOpenEdit}
        isError={isError}
        isLoading={isLoading}
        refetch={refetch}
        t={t}
        tags={tags}
      />

      {/* Create/Edit dialog */}
      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingTag ? t("tag.editTag") : t("tag.newTag")}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tag-name">{t("tag.tagName")}</Label>
              <Input
                autoFocus
                disabled={isPending}
                id="tag-name"
                maxLength={50}
                onChange={(e) => setTagName(e.target.value)}
                placeholder={t("tag.tagName")}
                value={tagName}
              />
            </div>

            <div className="space-y-2.5">
              <Label>{t("tag.tagColor")}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 transition-all",
                    tagColor === null
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground"
                  )}
                  onClick={() => setTagColor(null)}
                  type="button"
                >
                  <HugeiconsIcon
                    className="size-4 text-muted-foreground"
                    icon={Cancel01Icon}
                  />
                </button>
                {PRESET_COLORS.map((color) => (
                  <button
                    aria-label={color}
                    className={cn(
                      "size-8 rounded-full border-2 transition-all",
                      tagColor === color
                        ? "scale-110 border-foreground/30 ring-2 ring-foreground/10"
                        : "border-transparent hover:scale-110"
                    )}
                    key={color}
                    onClick={() => setTagColor(color)}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>{t("tag.preview")}</Label>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-secondary/30 px-4 py-3">
                {tagColor ? (
                  <span
                    className="size-3 rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: tagColor }}
                  />
                ) : (
                  <HugeiconsIcon
                    className="size-3 text-muted-foreground"
                    icon={Tag01Icon}
                  />
                )}
                <span className="text-sm font-medium">
                  {tagName || t("tag.tagName")}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={handleCloseDialog}
                type="button"
                variant="outline"
              >
                {t("common.cancel")}
              </Button>
              <Button disabled={!tagName.trim() || isPending} type="submit">
                {isPending
                  ? t("common.loading")
                  : getSubmitLabel(editingTag, t)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        description={t("tag.deleteConfirmDesc", {
          name: deleteTarget?.name || ""
        })}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={!!deleteTarget}
        title={t("tag.deleteConfirmTitle")}
      />
    </PageContainer>
  )
}

function TagCard({
  tag,
  onEdit,
  onDelete
}: {
  tag: Tag
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: ["tags", tag.id, "entriesCount"],
    queryFn: () => orpc.tags.getEntriesCount.call({ id: tag.id })
  })

  const entriesCount = countData?.count ?? 0

  return (
    <Surface className="group relative overflow-hidden" interactive>
      {/* Color accent bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: tag.color ?? "var(--primary)" }}
      />

      <Link
        className="block py-1 pl-4"
        onClick={() => {
          queryClient.invalidateQueries({ queryKey: ["entries", "library"] })
        }}
        search={{ tagId: tag.id }}
        to="/library"
      >
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {tag.color ? (
                <span
                  className="size-3 shrink-0 rounded-full ring-1 ring-black/5"
                  style={{ backgroundColor: tag.color }}
                />
              ) : (
                <HugeiconsIcon
                  className="size-3 shrink-0 text-muted-foreground"
                  icon={Tag01Icon}
                />
              )}
              <h3 className="truncate font-medium text-foreground">
                {tag.name}
              </h3>
            </div>
            <p className="pl-5 text-sm text-muted-foreground tabular-nums">
              {t("entry.count", { count: entriesCount })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              className="h-7 w-7"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEdit()
              }}
              size="icon"
              variant="ghost"
            >
              <HugeiconsIcon className="size-3.5" icon={Edit02Icon} />
            </Button>
            <Button
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDelete()
              }}
              size="icon"
              variant="ghost"
            >
              <HugeiconsIcon className="size-3.5" icon={Delete02Icon} />
            </Button>
          </div>
        </div>
      </Link>
    </Surface>
  )
}

interface TagListContentProps {
  isLoading: boolean
  isError: boolean
  error: Error | null
  tags: Tag[]
  handleOpenCreate: () => void
  handleOpenEdit: (tag: Tag) => void
  handleDelete: (tag: Tag) => void
  refetch: () => void
  t: (key: string) => string
}

function TagListContent({
  isLoading,
  isError,
  error,
  tags,
  handleOpenCreate,
  handleOpenEdit,
  handleDelete,
  refetch,
  t
}: TagListContentProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            className={cn(
              "h-20 rounded-2xl",
              `animate-fade-in delay-${((i % 4) + 1) * 100}`
            )}
            key={`tag-skel-${String(i)}`}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-4">
          <HugeiconsIcon
            className="size-8 text-destructive/50"
            icon={Tag01Icon}
          />
        </div>
        <p className="mb-1 font-display text-lg font-medium text-destructive">
          {t("common.error")}
        </p>
        <p className="mb-5 max-w-sm text-sm text-muted-foreground">
          {error?.message ?? t("common.unknownError")}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          {t("common.retry")}
        </Button>
      </div>
    )
  }

  if (tags.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
        <div className="mb-4 rounded-full bg-primary/5 p-4">
          <HugeiconsIcon className="size-8 text-primary/40" icon={Tag01Icon} />
        </div>
        <p className="mb-1 font-display text-lg font-medium text-foreground/70">
          {t("tag.noTags")}
        </p>
        <p className="mb-5 max-w-sm text-sm text-muted-foreground">
          {t("tag.addTag")}
        </p>
        <Button onClick={handleOpenCreate} variant="outline">
          <HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
          {t("tag.newTag")}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tags.map((tag: Tag, i: number) => (
        <Reveal delay={i * 60} key={tag.id}>
          <TagCard
            onDelete={() => handleDelete(tag)}
            onEdit={() => handleOpenEdit(tag)}
            tag={tag}
          />
        </Reveal>
      ))}
    </div>
  )
}
