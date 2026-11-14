import { Button } from "@folionote/ui/button"
import { Card, CardContent, CardHeader } from "@folionote/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@folionote/ui/dropdown-menu"
import {
  Delete02Icon,
  MoreVerticalIcon,
  PinIcon,
  StarIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

const entryDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
})

const handleTriggerClick = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

interface EntryCardProps {
  id: string
  title: string
  /** 纯文本内容，用于预览和搜索 */
  contentText?: string | null
  isStarred: boolean
  isPinned: boolean
  updatedAt: string | number | Date
  onStar?: () => void
  onPin?: () => void
  onDelete?: () => void
}

type EntryCardActionsProps = Pick<
  EntryCardProps,
  "isStarred" | "isPinned" | "onStar" | "onPin" | "onDelete"
>

/**
 * Mobile dropdown menu for entry card actions
 */
function MobileActionsMenu({
  isStarred,
  isPinned,
  onStar,
  onPin,
  onDelete
}: EntryCardActionsProps) {
  const { t } = useTranslation()

  const handleStarClick = (e: MouseEvent) => {
    e.stopPropagation()
    onStar?.()
  }

  const handlePinClick = (e: MouseEvent) => {
    e.stopPropagation()
    onPin?.()
  }

  const handleDeleteClick = (e: MouseEvent) => {
    e.stopPropagation()
    onDelete?.()
  }

  return (
    <div className="absolute right-2 bottom-2 md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-8 w-8"
            onClick={handleTriggerClick}
            size="icon"
            variant="ghost"
          >
            <HugeiconsIcon
              className="size-4 text-muted-foreground"
              icon={MoreVerticalIcon}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {onStar ? (
            <DropdownMenuItem onClick={handleStarClick}>
              <HugeiconsIcon
                className={cn(
                  "mr-2 size-4",
                  isStarred ? "fill-amber-500 text-amber-500" : ""
                )}
                icon={StarIcon}
              />
              {isStarred ? t("entry.unstar") : t("entry.star")}
            </DropdownMenuItem>
          ) : null}
          {onPin ? (
            <DropdownMenuItem onClick={handlePinClick}>
              <HugeiconsIcon
                className={cn(
                  "mr-2 size-4",
                  isPinned ? "fill-primary text-primary" : ""
                )}
                icon={PinIcon}
              />
              {isPinned ? t("entry.unpin") : t("entry.pin")}
            </DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <>
              {(onStar || onPin) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={handleDeleteClick}
                variant="destructive"
              >
                <HugeiconsIcon className="mr-2 size-4" icon={Delete02Icon} />
                {t("common.delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * Desktop hover action buttons for entry card
 */
function DesktopActionButtons({
  isStarred,
  isPinned,
  onStar,
  onPin,
  onDelete
}: EntryCardActionsProps) {
  const handleStarClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onStar?.()
  }

  const handlePinClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onPin?.()
  }

  const handleDeleteClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete?.()
  }

  return (
    <div className="absolute right-2 bottom-2 hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
      {onStar ? (
        <Button
          className="h-8 w-8"
          onClick={handleStarClick}
          size="icon"
          variant="ghost"
        >
          <HugeiconsIcon
            className={cn(
              "size-4",
              isStarred ? "fill-amber-500 text-amber-500" : ""
            )}
            icon={StarIcon}
          />
        </Button>
      ) : null}
      {onPin ? (
        <Button
          className="h-8 w-8"
          onClick={handlePinClick}
          size="icon"
          variant="ghost"
        >
          <HugeiconsIcon
            className={cn(
              "size-4",
              isPinned ? "fill-primary text-primary" : ""
            )}
            icon={PinIcon}
          />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <HugeiconsIcon className="size-4" icon={Delete02Icon} />
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Render an entry card showing title, plain-text content preview, updated date, and optional action buttons for star, pin, and delete.
 *
 * The preview strips HTML and is truncated to 150 characters. Action buttons, when provided, prevent navigation and stop event propagation before invoking their callbacks.
 *
 * @returns A JSX element representing the entry card
 */
export function EntryCard({
  id,
  title,
  contentText,
  isStarred,
  isPinned,
  updatedAt,
  onStar,
  onPin,
  onDelete
}: EntryCardProps) {
  const { t } = useTranslation()
  const plainContent = contentText ?? ""
  const preview =
    plainContent.slice(0, 150) + (plainContent.length > 150 ? "..." : "")

  // Normalize date to Date object
  const date = new Date(updatedAt)

  // Format date
  const formattedDate = entryDateFormatter.format(date)

  const hasActions = onStar || onPin || onDelete
  const actionProps = { isStarred, isPinned, onStar, onPin, onDelete }

  return (
    <Card className="group relative transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <Link className="block" params={{ id }} to="/entries/$id">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-semibold text-foreground">
              {title || t("entryCard.untitled")}
            </h3>
            {/* Status indicators - always visible when active */}
            <div className="flex items-center gap-1">
              {isPinned ? (
                <HugeiconsIcon
                  className="size-4 fill-primary text-primary"
                  icon={PinIcon}
                />
              ) : null}
              {isStarred ? (
                <HugeiconsIcon
                  className="size-4 fill-amber-500 text-amber-500"
                  icon={StarIcon}
                />
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {preview || t("entryCard.emptyNote")}
          </p>
          <p className="text-xs text-muted-foreground">{formattedDate}</p>
        </CardContent>
      </Link>

      {/* Mobile: Dropdown menu trigger - always visible */}
      {hasActions ? <MobileActionsMenu {...actionProps} /> : null}

      {/* Desktop: Action buttons - shown on hover */}
      {hasActions ? <DesktopActionButtons {...actionProps} /> : null}
    </Card>
  )
}
