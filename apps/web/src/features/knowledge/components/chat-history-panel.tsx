import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@folionote/ui/alert-dialog"
import { Button } from "@folionote/ui/button"
import { Skeleton } from "@folionote/ui/skeleton"
import {
  Delete02Icon,
  MessageAdd01Icon,
  MessageMultiple01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { formatDistanceToNow } from "date-fns"
import { memo, useCallback, useState } from "react"
import type { JSX } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import type { ChatSessionSummary } from "../types"

// =============================================================================
// Types
// =============================================================================

interface ChatHistoryPanelProps {
  /** List of chat sessions */
  sessions: ChatSessionSummary[]
  /** Currently selected chat ID */
  selectedChatId: string | null
  /** Loading state */
  isLoading: boolean
  /** Called when a chat is selected */
  onSelectChat: (chatId: string) => void
  /** Called when new chat button is clicked */
  onNewChat: () => void
  /** Called when a chat should be deleted */
  onDeleteChat: (chatId: string) => void
  /** Optional class name */
  className?: string
}

// =============================================================================
// Chat Item Component
// =============================================================================

interface ChatItemProps {
  session: ChatSessionSummary
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

interface DeleteChatCandidate {
  chatId: string
  title: string
}

const ChatItem = memo(
  ({ session, isSelected, onSelect, onDelete }: ChatItemProps) => {
    const { t } = useTranslation()
    const [isHovered, setIsHovered] = useState(false)

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        onDelete()
      },
      [onDelete]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault()
          onDelete()
        }
      },
      [onSelect, onDelete]
    )

    // Format the time
    const timeAgo = session.lastOpenedAt
      ? formatDistanceToNow(new Date(session.lastOpenedAt), { addSuffix: true })
      : ""

    // Display title or fallback
    const displayTitle = session.title || t("knowledge.untitledChat")

    return (
      <div
        aria-selected={isSelected}
        className={cn(
          "group relative flex cursor-pointer flex-col gap-1 rounded-lg border-transparent border-l-2 px-3 py-2",
          "[contain-intrinsic-size:96px] [content-visibility:auto]",
          "transition-colors duration-200 motion-reduce:transition-none",
          "hover:bg-surface-secondary/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && "border-primary bg-surface-secondary"
        )}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="option"
        tabIndex={0}
      >
        {/* Title row */}
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            className="size-4 shrink-0 text-muted-foreground"
            icon={MessageMultiple01Icon}
          />
          <span
            className={cn(
              "flex-1 truncate font-medium text-sm",
              isSelected && "text-foreground"
            )}
          >
            {displayTitle}
          </span>

          {/* Delete button (visible on hover) */}
          <Button
            aria-label={t("knowledge.deleteChat")}
            className={cn(
              "size-5 shrink-0 transition-opacity duration-200 motion-reduce:transition-none",
              isHovered || isSelected
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            )}
            onClick={handleDelete}
            size="icon"
            tabIndex={isHovered || isSelected ? 0 : -1}
            variant="ghost"
          >
            <HugeiconsIcon className="size-3.5" icon={Delete02Icon} />
          </Button>
        </div>

        {/* Preview row */}
        {session.lastMessagePreview && (
          <p className="truncate pl-6 text-xs text-muted-foreground">
            {session.lastMessagePreview}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-2 pl-6 text-[10px] text-muted-foreground/70">
          <span className="font-[tabular-nums]">
            {session.messageCount} {t("knowledge.messages")}
          </span>
          {timeAgo && (
            <>
              <span>•</span>
              <span>{timeAgo}</span>
            </>
          )}
        </div>
      </div>
    )
  }
)

// =============================================================================
// Loading Skeleton
// =============================================================================

function ChatItemSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <Skeleton className="ml-6 h-3 w-3/4" />
      <Skeleton className="ml-6 h-2 w-1/2" />
    </div>
  )
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex animate-in flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted-foreground/20 bg-surface-secondary/10 p-6 text-center duration-200 fade-in-0 motion-reduce:animate-none">
      <HugeiconsIcon
        className="size-10 text-muted-foreground/40"
        icon={MessageMultiple01Icon}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          {t("knowledge.noChats")}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {t("knowledge.startNewChatDescription")}
        </p>
      </div>
      <Button onClick={onNewChat} size="sm" variant="outline">
        <HugeiconsIcon className="mr-2 size-4" icon={MessageAdd01Icon} />
        {t("knowledge.newChat")}
      </Button>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export const ChatHistoryPanel = memo(
  ({
    sessions,
    selectedChatId,
    isLoading,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    className
  }: ChatHistoryPanelProps) => {
    const { t } = useTranslation()
    const [deleteCandidate, setDeleteCandidate] =
      useState<DeleteChatCandidate | null>(null)
    let chatListContent: JSX.Element

    const requestDeleteChat = useCallback((chatId: string, title: string) => {
      setDeleteCandidate({ chatId, title })
    }, [])

    const confirmDeleteChat = useCallback(() => {
      if (!deleteCandidate) {
        return
      }

      onDeleteChat(deleteCandidate.chatId)
      setDeleteCandidate(null)
    }, [deleteCandidate, onDeleteChat])

    const handleDeleteDialogOpenChange = useCallback((isOpen: boolean) => {
      if (!isOpen) {
        setDeleteCandidate(null)
      }
    }, [])

    const deleteChatTitle =
      deleteCandidate?.title || t("knowledge.untitledChat")

    if (isLoading) {
      chatListContent = (
        <div className="space-y-2">
          <ChatItemSkeleton />
          <ChatItemSkeleton />
          <ChatItemSkeleton />
        </div>
      )
    } else if (sessions.length === 0) {
      chatListContent = <EmptyState onNewChat={onNewChat} />
    } else {
      chatListContent = (
        <div className="space-y-1">
          {sessions.map((session) => {
            const displayTitle = session.title || t("knowledge.untitledChat")

            return (
              <ChatItem
                isSelected={session.chatId === selectedChatId}
                key={session.chatId}
                onDelete={() => requestDeleteChat(session.chatId, displayTitle)}
                onSelect={() => onSelectChat(session.chatId)}
                session={session}
              />
            )
          })}
        </div>
      )
    }

    return (
      <div
        className={cn("flex h-full flex-col border-r bg-background", className)}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
          <h2 className="text-sm font-semibold">
            {t("knowledge.chatHistory")}
          </h2>
          <Button
            aria-label={t("knowledge.newChat")}
            onClick={onNewChat}
            size="icon"
            variant="ghost"
          >
            <HugeiconsIcon className="size-4" icon={MessageAdd01Icon} />
          </Button>
        </div>

        {/* Chat list */}
        <div
          aria-label={t("knowledge.chatHistory")}
          className="flex-1 overflow-y-auto p-2"
          role="listbox"
        >
          {chatListContent}
        </div>
        <AlertDialog
          onOpenChange={handleDeleteDialogOpenChange}
          open={Boolean(deleteCandidate)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("knowledge.deleteChatConfirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-pretty">
                {t("knowledge.deleteChatConfirmDescription", {
                  title: deleteChatTitle
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteChat}
                variant="destructive"
              >
                {t("knowledge.deleteChat")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }
)
