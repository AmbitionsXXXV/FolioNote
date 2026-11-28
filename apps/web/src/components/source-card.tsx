import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import {
  Delete02Icon,
  Edit02Icon,
  Link04Icon
} from "@hugeicons-pro/core-stroke-rounded"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Surface } from "@/components/surface"

const sourceDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric"
})

interface SourceCardProps {
  id: string
  title: string
  type: string
  typeLabel: string
  icon: IconSvgElement
  url?: string | null
  author?: string | null
  publishedAt?: Date | string | null
  updatedAt: Date | string
  onEdit?: () => void
  onDelete?: () => void
}

export function SourceCard({
  title,
  typeLabel,
  icon,
  url,
  author,
  publishedAt,
  updatedAt,
  onEdit,
  onDelete
}: SourceCardProps) {
  const formattedDate = sourceDateFormatter.format(new Date(updatedAt))

  const formattedPublishedAt = publishedAt
    ? sourceDateFormatter.format(new Date(publishedAt))
    : null

  return (
    <Surface className="group relative p-5" interactive>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon className="size-5 text-primary" icon={icon} />
          </div>
          <Badge variant="secondary">{typeLabel}</Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit ? (
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
          ) : null}
          {onDelete ? (
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
          ) : null}
        </div>
      </div>
      <h3 className="mb-2 line-clamp-2 font-display font-semibold text-foreground">
        {title}
      </h3>
      {author ? (
        <p className="mb-1 text-sm text-muted-foreground">作者: {author}</p>
      ) : null}
      {formattedPublishedAt ? (
        <p className="mb-1 text-sm text-muted-foreground">
          发布于: {formattedPublishedAt}
        </p>
      ) : null}
      {url ? (
        <a
          className="mb-2 flex items-center gap-1 text-sm text-primary hover:underline"
          href={url}
          onClick={(e) => e.stopPropagation()}
          rel="noopener noreferrer"
          target="_blank"
        >
          <HugeiconsIcon className="size-3" icon={Link04Icon} />
          <span className="line-clamp-1">{new URL(url).hostname}</span>
        </a>
      ) : null}
      <p className="text-xs text-muted-foreground">更新于 {formattedDate}</p>
    </Surface>
  )
}
