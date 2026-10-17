import { Button } from "@folionote/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@folionote/ui/dropdown-menu"
import { Input } from "@folionote/ui/input"
import { Spinner } from "@folionote/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@folionote/ui/tooltip"
import {
  ArchiveIcon,
  ArrowLeft01Icon,
  Delete02Icon,
  InboxIcon,
  LockPasswordIcon,
  MoreHorizontalIcon,
  PinIcon,
  Share01Icon,
  StarIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { createImageCommand } from "@/components/editor/image-command"
import {
  createRefCommandWithEvent,
  getCurrentEditor,
  insertEntryRef
} from "@/components/editor/ref-command"
import { createSourceCommandWithEvent } from "@/components/editor/source-command"
import { createTagCommand } from "@/components/editor/tag-command"
import { EntryEditor } from "@/components/entry-editor"
import { EntryPasswordDialog } from "@/components/entry-password-dialog"
import { EntryPicker } from "@/components/entry-picker"
import type { EntryPickerRef } from "@/components/entry-picker"
import {
  CollabSyncPill,
  EntryPresenceStack
} from "@/components/entry-presence-stack"
import { EntrySources } from "@/components/entry-sources"
import type { EntrySourcesRef } from "@/components/entry-sources"
import { EntryTags } from "@/components/entry-tags"
import type { EntryTagsRef } from "@/components/entry-tags"
import { EntrySourceStatus } from "@/components/imports/entry-source-status"
import { SaveStatusIndicator } from "@/components/save-status-indicator"
import { ShareDialog } from "@/components/share-dialog"
import { TableOfContents } from "@/components/table-of-contents"
import { useAutoSave } from "@/hooks/use-auto-save"
import type { SaveStatus } from "@/hooks/use-auto-save"
import { useEntryCollab } from "@/hooks/use-entry-collab"
import type {
  CollabConnectionState,
  CollabParticipant
} from "@/hooks/use-entry-collab"
import { useTocPosition } from "@/hooks/use-toc-position"
import { authClient } from "@/lib/auth-client"
import { createPageHead } from "@/lib/seo"
import { parseTocFromContent } from "@/lib/toc"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

const entryTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
})

const actionButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"

export const Route = createFileRoute("/_app/entries/$id")({
  loader: async ({ params, context: { queryClient } }) => {
    if (typeof window === "undefined") {
      return { entry: undefined }
    }

    const entry = await queryClient.ensureQueryData({
      queryKey: ["entries", params.id],
      queryFn: () => orpc.entries.get.call({ id: params.id })
    })
    return { entry }
  },

  head: ({ loaderData }) =>
    createPageHead({
      title: loaderData?.entry?.title
        ? `Edit · ${loaderData.entry.title}`
        : "Edit · Untitled",
      description: loaderData?.entry?.title
        ? `Edit entry: ${loaderData.entry.title}`
        : "Edit entry"
    }),

  component: EntryEditPage
})

/**
 * 更新条目的数据类型
 */
interface UpdateEntryData {
  id: string
  title?: string
  contentJson?: string
  isInbox?: boolean
  isStarred?: boolean
  isPinned?: boolean
  expectedVersion?: string
}

/**
 * Build the editor slash-command set and image uploader, and wire the
 * source/entry picker custom events emitted by those commands.
 *
 * Owns the tag/source/picker refs (created here so React can treat them as
 * stable) and returns them for the route to thread into its child components.
 */
function useEditorCommands(id: string) {
  const { t } = useTranslation()
  const entryTagsRef = useRef<EntryTagsRef>(null)
  const entrySourcesRef = useRef<EntrySourcesRef>(null)
  const entryPickerRef = useRef<EntryPickerRef>(null)

  // Create tag command for slash menu
  const tagCommand = useMemo(
    () =>
      createTagCommand(
        {
          getTags: () => entryTagsRef.current?.getTags() ?? [],
          onAddTag: (tagId) => {
            entryTagsRef.current?.addTag(tagId)
          }
        },
        t
      ),
    [t]
  )

  // Create source command for slash menu
  const sourceCommand = useMemo(() => createSourceCommandWithEvent(t), [t])

  // Create ref command for slash menu
  const refCommand = useMemo(() => createRefCommandWithEvent(t), [t])

  const uploadImage = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const chunks: string[] = []
      for (let i = 0; i < bytes.length; i += 8192) {
        const chunk = bytes.subarray(i, i + 8192)
        chunks.push(String.fromCodePoint(...chunk))
      }
      const binary = chunks.join("")
      const base64 = btoa(binary)
      const result = await orpc.storage.uploadAttachment.call({
        fileData: base64,
        contentType: file.type as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp"
          | "image/svg+xml",
        filename: file.name,
        entryId: id
      })
      return { publicUrl: result.publicUrl }
    },
    [id]
  )

  const imageCommand = useMemo(
    () => createImageCommand({ t, uploadImage }),
    [t, uploadImage]
  )

  const additionalCommands = useMemo(
    () => [tagCommand, sourceCommand, refCommand, imageCommand],
    [tagCommand, sourceCommand, refCommand, imageCommand]
  )

  // Listen for custom events from slash commands
  useEffect(() => {
    const handleOpenSourcePicker = () => {
      entrySourcesRef.current?.openSourcePicker()
    }

    const handleOpenEntryPicker = () => {
      entryPickerRef.current?.open()
    }

    document.addEventListener(
      "folio-note:open-source-picker",
      handleOpenSourcePicker
    )
    document.addEventListener(
      "folio-note:open-entry-picker",
      handleOpenEntryPicker
    )

    return () => {
      document.removeEventListener(
        "folio-note:open-source-picker",
        handleOpenSourcePicker
      )
      document.removeEventListener(
        "folio-note:open-entry-picker",
        handleOpenEntryPicker
      )
    }
  }, [])

  return {
    additionalCommands,
    uploadImage,
    entryTagsRef,
    entrySourcesRef,
    entryPickerRef
  }
}

/**
 * Remount the fumadocs TOC once heading ids are present in the DOM.
 *
 * Headings get stable slug ids from the HeadingIds editor extension, but the
 * fumadocs TOC sets up its observer on mount — before TipTap (immediatelyRender:
 * false) has rendered them. This returns the editor content ref to attach plus
 * a render key that bumps once the ids appear so the TOC can be remounted.
 */
function useTocRemountKey(tocContent: string) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [tocRenderKey, setTocRenderKey] = useState(0)
  const tocItems = useMemo(() => parseTocFromContent(tocContent), [tocContent])

  useEffect(() => {
    const container = contentRef.current
    if (!container || tocItems.length === 0) {
      return
    }

    let didRemount = false

    const remountWhenHeadingsReady = () => {
      const hasAnyObservedHeading = tocItems.some((item) => {
        // URL is always prefixed with # by makeUniqueItems
        const id = item.url.slice(1)
        if (!id) {
          return false
        }

        // getElementById (not querySelector(`#${id}`)): slugs from numeric
        // headings (e.g. "2026-1-7") are valid ids but invalid CSS selectors.
        const element = document.getElementById(id)
        return element !== null && container.contains(element)
      })

      if (hasAnyObservedHeading && !didRemount) {
        didRemount = true
        setTocRenderKey((prev) => prev + 1)
        return true
      }

      return hasAnyObservedHeading
    }

    if (typeof MutationObserver === "undefined") {
      remountWhenHeadingsReady()
      return
    }

    if (remountWhenHeadingsReady()) {
      return
    }

    const observer = new MutationObserver(() => {
      if (remountWhenHeadingsReady()) {
        observer.disconnect()
      }
    })

    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [tocItems])

  return { contentRef, tocRenderKey, tocItems }
}

interface UseEntryMutationsParams {
  id: string
  entry: { isInbox: boolean } | undefined
  setCurrentVersion: (version: string) => void
}

/**
 * Mutations for non-content entry updates (star/pin/inbox) and deletion,
 * including version tracking, cache invalidation, and conflict toasts.
 */
function useEntryMutations({
  id,
  entry,
  setCurrentVersion
}: UseEntryMutationsParams) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Update mutation for non-content updates (star, pin, inbox)
  const updateMutation = useMutation({
    mutationFn: (data: UpdateEntryData) => orpc.entries.update.call(data),
    onSuccess: (result) => {
      if (result.version) {
        setCurrentVersion(result.version)
      }
      queryClient.invalidateQueries({ queryKey: ["entries"] })
    },
    onError: (error) => {
      // 检查是否是版本冲突错误
      if (error.message?.includes("Version conflict")) {
        toast.error(t("entry.versionConflict"))
        // 重新获取最新数据
        queryClient.invalidateQueries({ queryKey: ["entries", id] })
      } else {
        toast.error(t("entry.saveFailed"))
      }
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (data: { id: string }) => orpc.entries.delete.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] })
      toast.success(t("entry.movedToTrash"))
      navigate({ to: entry?.isInbox ? "/inbox" : "/library" })
    }
  })

  return { updateMutation, deleteMutation }
}

interface EntryToolbarProps {
  isInbox: boolean
  isStarred: boolean
  isPinned: boolean
  saveStatus: SaveStatus
  /** Collaborators get a slimmer toolbar: back, presence, sync — the rest
   *  are the owner's personal organization and are hidden, not disabled. */
  isOwner: boolean
  /** Collab entries swap the save indicator for the live sync pill — body
   *  content no longer flows through autosave there. */
  isCollab: boolean
  localUserName: string
  participants: CollabParticipant[]
  connectionState: CollabConnectionState
  onGoBack: () => void
  onMoveToLibrary: () => void
  onMoveToInbox: () => void
  onToggleStar: () => void
  onTogglePin: () => void
  onDelete: () => void
  onShare: () => void
  onPassword: () => void
  onJumpToParticipant: (participant: CollabParticipant) => void
}

/**
 * Header toolbar: back navigation, presence, sync/save status, and entry
 * actions (move, star, pin, delete, and the share/password overflow menu —
 * owner-only, see `isOwner`).
 */
function EntryToolbar({
  isInbox,
  isStarred,
  isPinned,
  saveStatus,
  isOwner,
  isCollab,
  localUserName,
  participants,
  connectionState,
  onGoBack,
  onMoveToLibrary,
  onMoveToInbox,
  onToggleStar,
  onTogglePin,
  onDelete,
  onShare,
  onPassword,
  onJumpToParticipant
}: EntryToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-6 flex items-center justify-between">
      <Button onClick={onGoBack} size="sm" variant="ghost">
        <HugeiconsIcon className="mr-2 size-4" icon={ArrowLeft01Icon} />
        {t("common.back")}
      </Button>

      <div className="flex items-center gap-2">
        {/* Who's here right now (empty until a second person connects) */}
        <EntryPresenceStack
          localUserName={localUserName}
          onJumpToParticipant={onJumpToParticipant}
          participants={participants}
        />

        {/* Live sync state for collab entries, save status otherwise */}
        {isCollab ? (
          <CollabSyncPill className="mr-2" connectionState={connectionState} />
        ) : (
          <SaveStatusIndicator className="mr-2" status={saveStatus} />
        )}

        {!isOwner ? null : (
          <>
            {/* Move to library/inbox */}
            {isInbox ? (
              <Tooltip>
                <TooltipTrigger
                  aria-label={t("entry.moveToLibrary")}
                  className={actionButtonClass}
                  onClick={onMoveToLibrary}
                >
                  <HugeiconsIcon className="size-4" icon={ArchiveIcon} />
                </TooltipTrigger>
                <TooltipContent>{t("entry.moveToLibrary")}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  aria-label={t("entry.moveToInbox")}
                  className={actionButtonClass}
                  onClick={onMoveToInbox}
                >
                  <HugeiconsIcon className="size-4" icon={InboxIcon} />
                </TooltipTrigger>
                <TooltipContent>{t("entry.moveToInbox")}</TooltipContent>
              </Tooltip>
            )}

            {/* Star */}
            <Tooltip>
              <TooltipTrigger
                aria-label={isStarred ? t("entry.unstar") : t("entry.star")}
                aria-pressed={isStarred}
                className={actionButtonClass}
                onClick={onToggleStar}
              >
                <HugeiconsIcon
                  className={cn(
                    "size-4 transition-colors",
                    isStarred && "fill-amber-500 text-amber-500"
                  )}
                  icon={StarIcon}
                />
              </TooltipTrigger>
              <TooltipContent>
                {isStarred ? t("entry.unstar") : t("entry.star")}
              </TooltipContent>
            </Tooltip>

            {/* Pin */}
            <Tooltip>
              <TooltipTrigger
                aria-label={isPinned ? t("entry.unpin") : t("entry.pin")}
                aria-pressed={isPinned}
                className={actionButtonClass}
                onClick={onTogglePin}
              >
                <HugeiconsIcon
                  className={cn(
                    "size-4 transition-colors",
                    isPinned && "fill-primary text-primary"
                  )}
                  icon={PinIcon}
                />
              </TooltipTrigger>
              <TooltipContent>
                {isPinned ? t("entry.unpin") : t("entry.pin")}
              </TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger
                aria-label={t("common.delete")}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-destructive/30 focus-visible:outline-none"
                onClick={onDelete}
              >
                <HugeiconsIcon className="size-4" icon={Delete02Icon} />
              </TooltipTrigger>
              <TooltipContent>{t("common.delete")}</TooltipContent>
            </Tooltip>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("common.more")}
                  size="icon"
                  variant="ghost"
                >
                  <HugeiconsIcon className="size-4" icon={MoreHorizontalIcon} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onShare}>
                  <HugeiconsIcon className="mr-2 size-4" icon={Share01Icon} />
                  {t("share.title")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPassword}>
                  <HugeiconsIcon
                    className="mr-2 size-4"
                    icon={LockPasswordIcon}
                  />
                  {t("privacy.title")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  )
}

interface EntryMetadataFooterProps {
  createdAt: Date | string | number
  updatedAt: Date | string | number
}

/**
 * Created/updated timestamp footer for the entry.
 */
function EntryMetadataFooter({
  createdAt,
  updatedAt
}: EntryMetadataFooterProps) {
  const { t } = useTranslation()

  return (
    <footer className="mt-8 border-t border-border/50 pt-4">
      <dl className="space-y-1 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <dt className="sr-only">{t("entry.createdAt")}</dt>
          <dd className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">
              {t("entry.createdAt")}
            </span>
            <time
              className="font-mono tabular-nums"
              dateTime={new Date(createdAt).toISOString()}
            >
              {entryTimestampFormatter.format(new Date(createdAt))}
            </time>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">{t("entry.updatedAt")}</dt>
          <dd className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">
              {t("entry.updatedAt")}
            </span>
            <time
              className="font-mono tabular-nums"
              dateTime={new Date(updatedAt).toISOString()}
            >
              {entryTimestampFormatter.format(new Date(updatedAt))}
            </time>
          </dd>
        </div>
      </dl>
    </footer>
  )
}

interface EntryDialogsProps {
  id: string
  entryTitle: string
  entryPickerRef: React.RefObject<EntryPickerRef | null>
  deleteOpen: boolean
  onDeleteOpenChange: (open: boolean) => void
  onConfirmDelete: () => void
  isDeleting: boolean
  shareOpen: boolean
  onShareOpenChange: (open: boolean) => void
  passwordOpen: boolean
  onPasswordOpenChange: (open: boolean) => void
}

/**
 * Modal surfaces for the entry: ref picker, delete confirmation, share, and
 * password protection.
 */
function EntryDialogs({
  id,
  entryTitle,
  entryPickerRef,
  deleteOpen,
  onDeleteOpenChange,
  onConfirmDelete,
  isDeleting,
  shareOpen,
  onShareOpenChange,
  passwordOpen,
  onPasswordOpenChange
}: EntryDialogsProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Entry picker dialog for /ref command */}
      <EntryPicker
        excludeId={id}
        onSelect={(selectedEntry) => {
          // Get the editor instance stored by the ref command
          const editor = getCurrentEditor()
          if (editor) {
            insertEntryRef(editor, selectedEntry, t)
          }
        }}
        ref={entryPickerRef}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        description={t("entry.deleteConfirmDesc")}
        isLoading={isDeleting}
        onConfirm={onConfirmDelete}
        onOpenChange={onDeleteOpenChange}
        open={deleteOpen}
        title={t("entry.deleteConfirmTitle")}
      />

      {/* Share dialog */}
      <ShareDialog
        entryId={id}
        entryTitle={entryTitle}
        onOpenChange={onShareOpenChange}
        open={shareOpen}
      />

      {/* Entry password dialog */}
      <EntryPasswordDialog
        entryId={id}
        onOpenChange={onPasswordOpenChange}
        open={passwordOpen}
      />
    </>
  )
}

/**
 * Render the entry editing UI for the current route id.
 *
 * Provides editable title and content, and actions to move the entry between inbox and library, toggle star and pin state, and delete the entry. Shows a loading spinner while fetching and a not-found fallback when the entry is missing.
 *
 * @returns The entry editor page UI element for the current entry.
 */
function EntryEditPage() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tocPosition] = useTocPosition()
  const { data: session } = authClient.useSession()

  const { data: entry, isLoading } = useQuery({
    queryKey: ["entries", id],
    queryFn: () => orpc.entries.get.call({ id })
  })

  // Password-locked entries never sync live — the collab server rejects
  // those connections outright too, this just avoids a doomed attempt.
  const isCollab = Boolean(entry?.isCollaborative && !entry.passwordHash)
  const {
    provider,
    connectionState,
    participants,
    localColor,
    jumpToParticipant
  } = useEntryCollab({
    entryId: id,
    enabled: isCollab && Boolean(session?.user?.id),
    userId: session?.user?.id ?? "",
    userName: session?.user?.name || "Someone",
    role: entry?.accessRole ?? "editor"
  })

  // Local state for optimistic updates
  const [localTitle, setLocalTitle] = useState<string | null>(null)
  const [localContent, setLocalContent] = useState<string | null>(null)
  // 跟踪当前版本号
  const [currentVersion, setCurrentVersion] = useState<string>("1")
  // 删除确认对话框状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  // 分享对话框状态
  const [showShareDialog, setShowShareDialog] = useState(false)
  // 密码保护对话框状态
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  // Debounced content for TOC (updated via autoSave debounce)
  const [debouncedContent, setDebouncedContent] = useState<string | null>(null)

  // 当 entry 加载完成时，更新版本号
  useEffect(() => {
    if (entry?.version) {
      setCurrentVersion(entry.version)
    }
  }, [entry?.version])

  // 自动保存 hook
  const { status: saveStatus, save: autoSave } = useAutoSave<UpdateEntryData>({
    onSave: async (data) => {
      const result = await orpc.entries.update.call(data)
      // 更新版本号
      if (result.version) {
        setCurrentVersion(result.version)
      }
      queryClient.invalidateQueries({ queryKey: ["entries"] })
      // Update debounced content for TOC after save completes
      if (data.contentJson) {
        setDebouncedContent(data.contentJson)
      }
    },
    debounceMs: 1000,
    savedDurationMs: 2000
  })

  const {
    additionalCommands,
    uploadImage,
    entryTagsRef,
    entrySourcesRef,
    entryPickerRef
  } = useEditorCommands(id)

  const { updateMutation, deleteMutation } = useEntryMutations({
    id,
    entry,
    setCurrentVersion
  })

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setLocalTitle(newTitle)
      autoSave({
        id,
        title: newTitle,
        expectedVersion: currentVersion
      })
    },
    [id, autoSave, currentVersion]
  )

  const handleContentChange = useCallback(
    (_html: string, json: string) => {
      setLocalContent(json)
      // Collab mode: body content persists exclusively through the collab
      // server's flush (apps/server/src/collab/server.ts), so this must not
      // also feed autoSave — but the TOC still needs the debounced content
      // it normally gets from autoSave's onSave (the editor already
      // debounces onChange 500ms, so setting it here directly is fine).
      if (isCollab) {
        setDebouncedContent(json)
        return
      }
      autoSave({
        id,
        contentJson: json,
        expectedVersion: currentVersion
      })
    },
    [id, autoSave, currentVersion, isCollab]
  )

  const handleToggleStar = useCallback(() => {
    if (!entry) {
      return
    }
    updateMutation.mutate({
      id,
      isStarred: !entry.isStarred,
      expectedVersion: currentVersion
    })
  }, [entry, id, updateMutation, currentVersion])

  const handleTogglePin = useCallback(() => {
    if (!entry) {
      return
    }
    updateMutation.mutate({
      id,
      isPinned: !entry.isPinned,
      expectedVersion: currentVersion
    })
  }, [entry, id, updateMutation, currentVersion])

  const handleMoveToLibrary = useCallback(() => {
    if (!entry) {
      return
    }
    updateMutation.mutate(
      { id, isInbox: false, expectedVersion: currentVersion },
      {
        onSuccess: () => {
          toast.success(t("entry.movedToLibrary"))
        }
      }
    )
  }, [entry, id, updateMutation, currentVersion, t])

  const handleMoveToInbox = useCallback(() => {
    if (!entry) {
      return
    }
    updateMutation.mutate(
      { id, isInbox: true, expectedVersion: currentVersion },
      {
        onSuccess: () => {
          toast.success(t("entry.movedToInbox"))
        }
      }
    )
  }, [entry, id, updateMutation, currentVersion, t])

  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setShowDeleteDialog(false)
        }
      }
    )
  }, [deleteMutation, id])

  const handleGoBack = useCallback(() => {
    navigate({ to: entry?.isInbox ? "/inbox" : "/library" })
  }, [entry, navigate])

  // 计算显示的保存状态
  const displaySaveStatus: SaveStatus = updateMutation.isPending
    ? "saving"
    : saveStatus

  // Parse TOC items from debounced content (uses autoSave's 1000ms debounce)
  const editorContent = localContent ?? entry?.contentJson ?? ""
  const tocContent = debouncedContent ?? entry?.contentJson ?? ""

  const { contentRef, tocRenderKey, tocItems } = useTocRemountKey(tocContent)

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("entry.notExist")}</p>
        <Button onClick={() => navigate({ to: "/inbox" })} variant="outline">
          {t("entry.backToInbox")}
        </Button>
      </div>
    )
  }

  const title = localTitle ?? entry.title
  const hasToc = tocItems.length > 0

  return (
    <div
      className={cn(
        "container mx-auto flex",
        hasToc ? "max-w-6xl" : "max-w-4xl"
      )}
    >
      {/* TOC on left side */}
      {hasToc && tocPosition === "left" && (
        <TableOfContents
          items={tocItems}
          key={tocRenderKey}
          position={tocPosition}
        />
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1 px-4 py-6">
        {/* Header toolbar */}
        <EntryToolbar
          connectionState={connectionState}
          isCollab={isCollab}
          isInbox={entry.isInbox}
          isOwner={entry.accessRole === "owner"}
          isPinned={entry.isPinned}
          isStarred={entry.isStarred}
          localUserName={session?.user?.name || "Someone"}
          onDelete={handleDeleteClick}
          onGoBack={handleGoBack}
          onJumpToParticipant={jumpToParticipant}
          onMoveToInbox={handleMoveToInbox}
          onMoveToLibrary={handleMoveToLibrary}
          onPassword={() => setShowPasswordDialog(true)}
          onShare={() => setShowShareDialog(true)}
          onTogglePin={handleTogglePin}
          onToggleStar={handleToggleStar}
          participants={participants}
          saveStatus={displaySaveStatus}
        />

        {/* Title input — owner-only; collaborators change content through
            the collab socket, not this entry's metadata (see entries.ts) */}
        <Input
          aria-label={t("entry.title")}
          autoComplete="off"
          className="mb-4 h-auto border-none bg-transparent py-2 font-display text-2xl font-semibold tracking-tight shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-0 disabled:cursor-default disabled:opacity-100 md:text-3xl"
          disabled={entry.accessRole !== "owner"}
          onChange={handleTitleChange}
          placeholder={t("entry.title")}
          spellCheck={false}
          value={title}
        />

        {/* Tags/sources are owner-managed metadata — hidden rather than
            disabled for collaborators, same as the toolbar actions above */}
        {entry.accessRole === "owner" && (
          <>
            <div className="mb-4">
              <EntryTags entryId={id} ref={entryTagsRef} />
            </div>
            <div className="mb-4">
              <EntrySources entryId={id} ref={entrySourcesRef} />
            </div>
            <div className="mb-4 empty:hidden">
              <EntrySourceStatus entryId={id} />
            </div>
          </>
        )}

        {/* Editor — flows directly on the page canvas (Lark-style), no card.
            Collaboration binds to a Y.Doc at editor construction time, not
            reactively, so two rules here: (1) never mount the editor while
            collab is enabled but the provider isn't ready yet — useEditor
            would permanently create a solo editor that silently drops every
            keystroke on the floor as far as other participants are
            concerned; (2) key the editor on the provider's own Y.Doc
            clientID so a recreated provider (React strict-mode re-running
            the hook effect) remounts the editor onto the live doc instead
            of a destroyed one. */}
        <div ref={contentRef}>
          {isCollab && !(provider && session?.user) ? (
            <div aria-busy="true" className="animate-pulse space-y-3">
              <div className="h-5 w-4/5 rounded bg-surface-secondary/60" />
              <div className="h-4 w-full rounded bg-surface-secondary/40" />
              <div className="h-4 w-3/4 rounded bg-surface-secondary/40" />
            </div>
          ) : (
            <EntryEditor
              additionalCommands={additionalCommands}
              autoFocus
              collab={
                isCollab && provider && session?.user
                  ? {
                      provider,
                      user: { name: session.user.name, color: localColor }
                    }
                  : undefined
              }
              content={editorContent}
              contentFormat="json"
              editable={entry.accessRole !== "viewer"}
              key={
                isCollab && provider
                  ? `${id}-collab-${provider.document.clientID}`
                  : `${id}-solo`
              }
              onChange={handleContentChange}
              onUploadImage={uploadImage}
              placeholder={t("editor.placeholderWithSlash")}
            />
          )}
        </div>

        {/* Metadata footer */}
        <EntryMetadataFooter
          createdAt={entry.createdAt}
          updatedAt={entry.updatedAt}
        />

        {/* Dialogs (ref picker, delete, share, password) */}
        <EntryDialogs
          deleteOpen={showDeleteDialog}
          entryPickerRef={entryPickerRef}
          entryTitle={entry.title}
          id={id}
          isDeleting={deleteMutation.isPending}
          onConfirmDelete={handleConfirmDelete}
          onDeleteOpenChange={setShowDeleteDialog}
          onPasswordOpenChange={setShowPasswordDialog}
          onShareOpenChange={setShowShareDialog}
          passwordOpen={showPasswordDialog}
          shareOpen={showShareDialog}
        />
      </div>

      {/* TOC on right side */}
      {hasToc && tocPosition === "right" && (
        <TableOfContents
          items={tocItems}
          key={tocRenderKey}
          position={tocPosition}
        />
      )}
    </div>
  )
}
