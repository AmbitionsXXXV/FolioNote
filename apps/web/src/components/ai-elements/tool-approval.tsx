import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import { cn } from "@folionote/ui/lib/utils"
import {
  Alert02Icon,
  Cancel01Icon,
  Delete02Icon,
  Tick02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"
import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"

// =============================================================================
// Types
// =============================================================================

export type ToolApprovalHandler = (params: {
  id: string
  approved: boolean
  reason?: string
}) => void | PromiseLike<void>

export type ToolApprovalButtonsProps = ComponentProps<"div"> & {
  /** The approval ID from the tool invocation */
  approvalId: string
  /** Tool name for display */
  toolName: string
  /** Tool input for display */
  input?: unknown
  /** Callback to handle approval/rejection */
  onApprovalResponse: ToolApprovalHandler
  /** Whether the buttons are disabled (e.g., during processing) */
  disabled?: boolean
}

// =============================================================================
// Helper Functions
// =============================================================================

const DESTRUCTIVE_TOOLS = new Set(["deleteNote"])

function isDestructiveTool(toolName: string): boolean {
  return DESTRUCTIVE_TOOLS.has(toolName)
}

function getToolDisplayName(toolName: string): string {
  const displayNames: Record<string, string> = {
    deleteNote: "Delete Note",
    createNote: "Create Note",
    updateNote: "Update Note",
    getNote: "Get Note",
    searchNotes: "Search Notes"
  }
  return displayNames[toolName] ?? toolName
}

function formatToolInput(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null
  }

  const record = input as Record<string, unknown>
  const fragments: string[] = []

  for (const [key, value] of Object.entries(record)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      fragments.push(`${key}: ${value}`)
    }
  }

  return fragments.length > 0 ? fragments.join(", ") : null
}

// =============================================================================
// Components
// =============================================================================

export const ToolApprovalButtons = memo(
  ({
    className,
    approvalId,
    toolName,
    input,
    onApprovalResponse,
    disabled = false,
    ...props
  }: ToolApprovalButtonsProps) => {
    const { t } = useTranslation()
    const isDestructive = isDestructiveTool(toolName)
    const displayName = getToolDisplayName(toolName)
    const inputSummary = formatToolInput(input)

    const handleApprove = useCallback(async () => {
      await onApprovalResponse({ id: approvalId, approved: true })
    }, [approvalId, onApprovalResponse])

    const handleReject = useCallback(async () => {
      await onApprovalResponse({
        id: approvalId,
        approved: false,
        reason: "User rejected"
      })
    }, [approvalId, onApprovalResponse])

    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-secondary/30 p-3",
          isDestructive && "border-destructive/30 bg-destructive/5",
          className
        )}
        {...props}
      >
        {/* Tool info */}
        <div className="flex items-start gap-2">
          {isDestructive ? (
            <HugeiconsIcon
              className="mt-0.5 size-4 shrink-0 text-destructive"
              icon={Delete02Icon}
            />
          ) : null}
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              {t("knowledge.toolApproval.title", { tool: displayName })}
            </p>
            {inputSummary ? (
              <p className="text-xs text-muted-foreground">{inputSummary}</p>
            ) : null}
            <Badge className="mt-1 w-fit gap-1 text-xs" variant="secondary">
              <HugeiconsIcon icon={Alert02Icon} size={12} />
              {t("knowledge.toolStatus.awaitingApproval")}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {isDestructive
                ? t("knowledge.toolApproval.destructiveWarning")
                : t("knowledge.toolApproval.description")}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={disabled}
            onClick={handleReject}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon className="mr-1.5 size-3.5" icon={Cancel01Icon} />
            {t("knowledge.toolApproval.reject")}
          </Button>
          <Button
            className="flex-1"
            disabled={disabled}
            onClick={handleApprove}
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
          >
            <HugeiconsIcon className="mr-1.5 size-3.5" icon={Tick02Icon} />
            {t("knowledge.toolApproval.approve")}
          </Button>
        </div>
      </div>
    )
  }
)
