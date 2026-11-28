import { Cancel01Icon, Tick02Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { UIMessage } from "ai"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle
} from "@/components/ai-elements/confirmation"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput
} from "@/components/ai-elements/tool"
import type { ToolApprovalHandler } from "@/components/ai-elements/tool-approval"
import { cn } from "@/lib/utils"

import {
  isDisplayWeatherPart,
  isStockPricePart,
  isStockTrendPart,
  isWebSearchPart
} from "./tool-cards"

export type ToolMessagePart = NonNullable<UIMessage["parts"]>[number]

type ToolApprovalInfo =
  | { id: string; approved?: never; reason?: never }
  | { id: string; approved: boolean; reason?: string }

const TOOL_DETAILS_OPEN_STATES = new Set([
  "approval-requested",
  "output-error",
  "output-denied"
])

export function isToolInvocationPart(
  part: ToolMessagePart
): part is ToolMessagePart & { type: string } {
  return (
    Boolean(part) &&
    typeof part === "object" &&
    "type" in part &&
    typeof part.type === "string" &&
    part.type.startsWith("tool-")
  )
}

export function isToolCardPart(part: ToolMessagePart): boolean {
  return (
    isDisplayWeatherPart(part) ||
    isStockPricePart(part) ||
    isStockTrendPart(part) ||
    isWebSearchPart(part)
  )
}

export function getToolKey(messageId: string, part: ToolMessagePart): string {
  if ("toolCallId" in part && typeof part.toolCallId === "string") {
    return part.toolCallId
  }
  const state =
    "state" in part && typeof part.state === "string" ? part.state : "tool"
  return `${messageId}-${part.type}-${state}`
}

function getToolLabel(part: ToolMessagePart): string {
  if ("toolName" in part && typeof part.toolName === "string") {
    return part.toolName
  }
  if ("type" in part && typeof part.type === "string") {
    return part.type
  }
  return "Tool"
}

function getToolPartState(part: ToolMessagePart, isStreaming: boolean): string {
  if ("state" in part && typeof part.state === "string") {
    return part.state
  }
  return isStreaming ? "input-streaming" : "input-available"
}

function getToolApproval(part: ToolMessagePart): ToolApprovalInfo | undefined {
  if (
    !("approval" in part) ||
    typeof part.approval !== "object" ||
    part.approval === null ||
    !("id" in part.approval)
  ) {
    return undefined
  }
  const raw = part.approval as Record<string, unknown>
  const id = raw.id as string
  if (typeof raw.approved === "boolean") {
    return {
      id,
      approved: raw.approved,
      reason: typeof raw.reason === "string" ? raw.reason : undefined
    }
  }
  return { id }
}

export interface ToolCallsProps {
  messageId: string
  isStreaming: boolean
  tools: ToolMessagePart[]
  className?: string
  onToolApprovalResponse?: ToolApprovalHandler
}

export const ToolCalls = memo(
  ({
    messageId,
    isStreaming,
    tools,
    className,
    onToolApprovalResponse
  }: ToolCallsProps) => {
    const { t } = useTranslation()
    const detailedTools = useMemo(
      () => tools.filter((tool) => !isToolCardPart(tool)),
      [tools]
    )

    if (detailedTools.length === 0) return null

    return (
      <div className={cn("space-y-2", className)}>
        {detailedTools.map((tool) => {
          const key = getToolKey(messageId, tool)
          const state = getToolPartState(tool, isStreaming)
          const label = getToolLabel(tool)
          const input = "input" in tool ? tool.input : undefined
          const output = "output" in tool ? tool.output : undefined
          const errorText =
            "errorText" in tool && typeof tool.errorText === "string"
              ? tool.errorText
              : undefined
          const defaultOpen = TOOL_DETAILS_OPEN_STATES.has(state)
          const approval = getToolApproval(tool)

          return (
            <Tool defaultOpen={defaultOpen} key={`detail-${key}`}>
              <ToolHeader label={label} state={state} />
              <ToolContent>
                {input !== undefined ? <ToolInput input={input} /> : null}
                <Confirmation
                  approval={approval}
                  state={state as Parameters<typeof Confirmation>[0]["state"]}
                >
                  <ConfirmationTitle>
                    <ConfirmationRequest>
                      {t("knowledge.toolApproval.description")}
                    </ConfirmationRequest>
                    <ConfirmationAccepted>
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon
                          className="size-4 text-emerald-600"
                          icon={Tick02Icon}
                        />
                        <span>{t("knowledge.toolApproval.accepted")}</span>
                      </span>
                    </ConfirmationAccepted>
                    <ConfirmationRejected>
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon
                          className="size-4 text-destructive"
                          icon={Cancel01Icon}
                        />
                        <span>{t("knowledge.toolApproval.rejected")}</span>
                      </span>
                    </ConfirmationRejected>
                  </ConfirmationTitle>
                  {onToolApprovalResponse && approval ? (
                    <ConfirmationActions>
                      <ConfirmationAction
                        onClick={() =>
                          onToolApprovalResponse({
                            id: approval.id,
                            approved: false,
                            reason: "User rejected"
                          })
                        }
                        variant="outline"
                      >
                        {t("knowledge.toolApproval.reject")}
                      </ConfirmationAction>
                      <ConfirmationAction
                        onClick={() =>
                          onToolApprovalResponse({
                            id: approval.id,
                            approved: true
                          })
                        }
                      >
                        {t("knowledge.toolApproval.approve")}
                      </ConfirmationAction>
                    </ConfirmationActions>
                  ) : null}
                </Confirmation>
                {output !== undefined || errorText ? (
                  <ToolOutput errorText={errorText} output={output} />
                ) : null}
              </ToolContent>
            </Tool>
          )
        })}
      </div>
    )
  }
)
