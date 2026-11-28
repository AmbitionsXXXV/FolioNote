import { PinIcon, StarIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Handle, Position } from "@xyflow/react"
import type { NodeProps } from "@xyflow/react"
import { memo } from "react"

import { cn } from "@/lib/utils"

import type { EntryFlowNode } from "./types"

const HUB_DEGREE = 6
const EMPHASIS_DEGREE = 3
const MAX_TITLE_LENGTH = 44

function GraphNodeComponent({ data, selected }: NodeProps<EntryFlowNode>) {
  const displayTitle = data.title.trim().length > 0 ? data.title : "Untitled"
  const truncatedTitle =
    displayTitle.length > MAX_TITLE_LENGTH
      ? `${displayTitle.slice(0, MAX_TITLE_LENGTH)}…`
      : displayTitle

  const isHub = data.degree >= HUB_DEGREE
  const isEmphasized = data.degree >= EMPHASIS_DEGREE
  const isFocused = data.focused || selected

  let titleClass = "text-[13px] font-medium"
  if (isHub) {
    titleClass = "text-sm font-semibold"
  } else if (isEmphasized) {
    titleClass = "text-sm font-medium"
  }

  return (
    <div
      className={cn(
        "group/node relative rounded-xl border bg-card px-3 py-2 text-card-foreground shadow-sm backdrop-blur-sm transition-all duration-200",
        "min-w-[120px] max-w-[220px] hover:-translate-y-0.5 hover:shadow-md",
        isEmphasized ? "border-primary/30" : "border-border",
        isHub && "border-primary/50",
        data.isInbox && "border-dashed",
        isFocused &&
          "shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background",
        data.dimmed && "opacity-40 saturate-50"
      )}
    >
      <Handle position={Position.Top} type="target" />

      <div className="flex items-center gap-1.5">
        {data.isStarred && (
          <HugeiconsIcon
            className="size-3 shrink-0 text-primary"
            icon={StarIcon}
          />
        )}
        {data.isPinned && (
          <HugeiconsIcon
            className="size-3 shrink-0 text-muted-foreground"
            icon={PinIcon}
          />
        )}
        <span className={cn("truncate", titleClass)}>{truncatedTitle}</span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        {data.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {data.tags.slice(0, 3).map((tag) => (
              <span
                className="inline-block size-2 rounded-full ring-1 ring-border/50"
                key={tag.id}
                style={{ backgroundColor: tag.color ?? "var(--color-muted)" }}
                title={tag.name}
              />
            ))}
            {data.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{data.tags.length - 3}
              </span>
            )}
          </div>
        )}
        {data.degree > 0 && (
          <span
            className={cn(
              "ml-auto text-[10px] tabular-nums",
              isHub ? "font-medium text-primary" : "text-muted-foreground/60"
            )}
          >
            {data.degree}
          </span>
        )}
      </div>

      <Handle position={Position.Bottom} type="source" />
    </div>
  )
}

export const EntryNode = memo(GraphNodeComponent)
