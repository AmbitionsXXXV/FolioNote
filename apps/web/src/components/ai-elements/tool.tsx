import { Badge } from "@folionote/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@folionote/ui/collapsible"
import {
  Alert02Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  Clock01Icon,
  Tick02Icon,
  Wrench01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { DynamicToolUIPart, ToolUIPart } from "ai"
import type { ComponentProps, ReactNode } from "react"
import { isValidElement } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

export type ToolState = ToolUIPart["state"] | DynamicToolUIPart["state"]

export type ToolPart = ToolUIPart | DynamicToolUIPart

const TOOL_STATE_CONFIG: Record<
  ToolState,
  { icon: typeof Clock01Icon; labelKey: string; className?: string }
> = {
  "input-streaming": {
    icon: Clock01Icon,
    labelKey: "knowledge.toolStatus.pending"
  },
  "input-available": {
    icon: Clock01Icon,
    labelKey: "knowledge.toolStatus.running"
  },
  "approval-requested": {
    icon: Alert02Icon,
    labelKey: "knowledge.toolStatus.awaitingApproval",
    className: "text-amber-600"
  },
  "approval-responded": {
    icon: Tick02Icon,
    labelKey: "knowledge.toolStatus.responded",
    className: "text-blue-600"
  },
  "output-available": {
    icon: Tick02Icon,
    labelKey: "knowledge.toolStatus.completed",
    className: "text-emerald-600"
  },
  "output-error": {
    icon: Cancel01Icon,
    labelKey: "knowledge.toolStatus.error",
    className: "text-destructive"
  },
  "output-denied": {
    icon: Cancel01Icon,
    labelKey: "knowledge.toolStatus.denied",
    className: "text-orange-600"
  }
}

export const getStatusBadge = (
  state: ToolState,
  t: (key: string) => string
) => {
  const config =
    TOOL_STATE_CONFIG[state] ?? TOOL_STATE_CONFIG["input-streaming"]
  return (
    <Badge
      className={cn("gap-1 rounded-full text-xs", config.className)}
      variant="secondary"
    >
      <HugeiconsIcon icon={config.icon} size={12} />
      <span>{t(config.labelKey)}</span>
    </Badge>
  )
}

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn(
      "group rounded-lg border border-border/60 bg-surface-secondary/30",
      className
    )}
    {...props}
  />
)

export type ToolHeaderProps = ComponentProps<typeof CollapsibleTrigger> & {
  state: ToolState | string
} & (
    | { label: string; title?: never; type?: never; toolName?: never }
    | {
        label?: never
        title?: string
        type: ToolUIPart["type"]
        toolName?: never
      }
    | {
        label?: never
        title?: string
        type: DynamicToolUIPart["type"]
        toolName: string
      }
  )

function deriveToolName(type?: string, toolName?: string): string {
  if (type === "dynamic-tool" && toolName) {
    return toolName
  }
  if (type) {
    return type.split("-").slice(1).join("-")
  }
  return "Tool"
}

export const ToolHeader = ({
  className,
  label,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const { t } = useTranslation()
  const config =
    TOOL_STATE_CONFIG[state as ToolState] ??
    TOOL_STATE_CONFIG["input-streaming"]
  const statusLabel = t(config.labelKey)

  const derivedName =
    label ??
    title ??
    deriveToolName(type as string | undefined, toolName as string | undefined)

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <HugeiconsIcon
          className="size-4 shrink-0 text-muted-foreground"
          icon={Wrench01Icon}
        />
        <span className="truncate text-sm font-medium">{derivedName}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={cn("gap-1", config.className)} variant="secondary">
          <HugeiconsIcon icon={config.icon} size={12} />
          <span>{statusLabel}</span>
        </Badge>
        <HugeiconsIcon
          className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          icon={ArrowDown01Icon}
        />
      </div>
    </CollapsibleTrigger>
  )
}

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "space-y-3 px-3 pb-3 text-sm",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
)

export type ToolInputProps = ComponentProps<"div"> & {
  input: unknown
}

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const { t } = useTranslation()
  const renderedValue = renderToolValue(input)

  if (!renderedValue) {
    return null
  }

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <p className="text-xs text-muted-foreground">
        {t("knowledge.tool.parameters")}
      </p>
      {renderedValue}
    </div>
  )
}

export type ToolOutputProps = ComponentProps<"div"> & {
  output?: unknown
  errorText?: string
}

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  const { t } = useTranslation()
  const isError = Boolean(errorText)
  const renderedValue = renderToolValue(isError ? errorText : output)

  if (!renderedValue) {
    return null
  }

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <p
        className={cn(
          "text-xs",
          isError ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {isError ? t("knowledge.tool.error") : t("knowledge.tool.result")}
      </p>
      {renderedValue}
    </div>
  )
}

function renderToolValue(value: unknown): ReactNode {
  if (value === undefined || value === null) {
    return null
  }
  if (isValidElement(value)) {
    return value
  }
  if (typeof value === "string") {
    return (
      <pre className="rounded-md bg-surface-secondary/60 p-2 font-mono text-xs whitespace-pre-wrap">
        {value}
      </pre>
    )
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <pre className="rounded-md bg-surface-secondary/60 p-2 font-mono text-xs whitespace-pre-wrap">
        {String(value)}
      </pre>
    )
  }

  const serialized = JSON.stringify(value, null, 2)
  if (!serialized) {
    return null
  }

  return (
    <pre className="rounded-md bg-surface-secondary/60 p-2 font-mono text-xs whitespace-pre-wrap">
      {serialized}
    </pre>
  )
}
