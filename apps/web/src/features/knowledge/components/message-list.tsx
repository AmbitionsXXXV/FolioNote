import { CollapsibleContent } from "@folionote/ui/collapsible"
import {
  AiBrain01Icon,
  Cancel01Icon,
  Tick02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Fragment, memo, useMemo } from "react"
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
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from "@/components/ai-elements/conversation"
import { Loader } from "@/components/ai-elements/loader"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger
} from "@/components/ai-elements/reasoning"
import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput
} from "@/components/ai-elements/tool"
import type { ToolApprovalHandler } from "@/components/ai-elements/tool-approval"
import { Message } from "@/components/chat-message"
import { cn } from "@/lib/utils"

import type { ChatMessage } from "../types"
import { CompactMessage } from "./compact-message"
import { MessageBubble } from "./message-bubble"
import {
  isDisplayWeatherPart,
  isStockPricePart,
  isStockTrendPart,
  isWebSearchPart
} from "./tool-cards"

// ============================================================================
// Waiting Indicator
// ============================================================================

const WAITING_SHIMMER_DURATION = 1.4
const WAITING_SHIMMER_SPREAD = 3
const WAITING_LOADER_SIZE = 14

const WaitingIndicator = memo(() => {
  const { t } = useTranslation()

  return (
    <Message from="assistant">
      <Reasoning
        className="mb-0 animate-in duration-200 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
        defaultOpen={false}
        isStreaming
      >
        <ReasoningTrigger
          getThinkingMessage={() => (
            <span className="flex items-center gap-2">
              <Loader size={WAITING_LOADER_SIZE} />
              <Shimmer
                duration={WAITING_SHIMMER_DURATION}
                spread={WAITING_SHIMMER_SPREAD}
              >
                {t("knowledge.thinkingInProgress")}
              </Shimmer>
            </span>
          )}
        />
      </Reasoning>
    </Message>
  )
})

// ============================================================================
// Message Process Components
// ============================================================================

type ToolMessagePart = NonNullable<ChatMessage["parts"]>[number]

const TOOL_TYPE_LABELS: Record<string, string> = {
  "tool-displayWeather": "Weather",
  "tool-getStockPrice": "Stock Price",
  "tool-getStockTrend": "Stock Trend",
  "tool-webSearch": "Web Search"
}

const TOOL_LABEL_FALLBACK = "Tool"
const TOOL_CALLS_FALLBACK_STATE = "tool"
const TOOL_DETAILS_OPEN_STATES = new Set([
  "approval-requested",
  "output-error",
  "output-denied"
])

const REASONING_TOOL_CALLS_CLASSNAME = [
  "mt-3 space-y-3 text-sm outline-none",
  "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2",
  "data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out",
  "data-[state=open]:animate-in duration-200 ease-out",
  "motion-reduce:transition-none motion-reduce:animate-none"
].join(" ")

function isToolInvocationPart(
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

function getToolLabel(part: ToolMessagePart): string {
  if ("toolName" in part && typeof part.toolName === "string") {
    return part.toolName
  }
  if ("type" in part && typeof part.type === "string") {
    return TOOL_TYPE_LABELS[part.type] ?? part.type
  }
  return TOOL_LABEL_FALLBACK
}

type ToolApprovalData =
  | { id: string; approved?: never; reason?: never }
  | { id: string; approved: boolean; reason?: string }

function getToolApproval(part: ToolMessagePart): ToolApprovalData | undefined {
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

function getToolKey(messageId: string, part: ToolMessagePart): string {
  const toolState =
    "state" in part && typeof part.state === "string"
      ? part.state
      : TOOL_CALLS_FALLBACK_STATE
  if ("toolCallId" in part && typeof part.toolCallId === "string") {
    return part.toolCallId
  }
  return `${messageId}-${part.type}-${toolState}`
}

function isToolCardPart(part: ToolMessagePart): boolean {
  return (
    isDisplayWeatherPart(part) ||
    isStockPricePart(part) ||
    isStockTrendPart(part) ||
    isWebSearchPart(part)
  )
}

function getToolPartState(part: ToolMessagePart, isStreaming: boolean): string {
  if ("state" in part && typeof part.state === "string") {
    return part.state
  }
  return isStreaming ? "input-streaming" : "input-available"
}

function shouldOpenToolDetails(state: string): boolean {
  return TOOL_DETAILS_OPEN_STATES.has(state)
}

interface ToolCallStepsProps {
  messageId: string
  isStreaming: boolean
  toolInvocations: ToolMessagePart[]
  className?: string
  onToolApprovalResponse?: ToolApprovalHandler
}

const ToolCallSteps = memo(
  ({
    messageId,
    isStreaming,
    toolInvocations,
    className,
    onToolApprovalResponse
  }: ToolCallStepsProps) => {
    const { t } = useTranslation()
    const detailedTools = toolInvocations.filter(
      (tool) => !isToolCardPart(tool)
    )

    if (detailedTools.length === 0) {
      return null
    }

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
          const defaultOpen = shouldOpenToolDetails(state)
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

interface MessageProcessProps {
  message: ChatMessage
  thinkingEnabled: boolean
  onToolApprovalResponse?: ToolApprovalHandler
}

const MessageProcess = memo(
  ({
    message,
    thinkingEnabled,
    onToolApprovalResponse
  }: MessageProcessProps) => {
    const toolInvocations = useMemo(
      () => (message.parts ?? []).filter(isToolInvocationPart),
      [message.parts]
    )

    if (message.role !== "assistant") return null

    const hasToolInvocations = toolInvocations.length > 0
    const hasThinking = Boolean(message.thinking && message.thinking.length > 0)
    const shouldShowReasoning = thinkingEnabled && hasThinking
    const shouldRenderProcess = shouldShowReasoning || hasToolInvocations

    if (!shouldRenderProcess) {
      return null
    }

    const isMessageStreaming = Boolean(message.isStreaming)

    if (shouldShowReasoning) {
      return (
        <Message from="assistant">
          <Reasoning className="mb-0" isStreaming={isMessageStreaming}>
            <ReasoningTrigger />
            {hasThinking ? (
              <ReasoningContent>{message.thinking ?? ""}</ReasoningContent>
            ) : null}
            {hasToolInvocations ? (
              <CollapsibleContent className={REASONING_TOOL_CALLS_CLASSNAME}>
                <ToolCallSteps
                  isStreaming={isMessageStreaming}
                  messageId={message.id}
                  onToolApprovalResponse={onToolApprovalResponse}
                  toolInvocations={toolInvocations}
                />
              </CollapsibleContent>
            ) : null}
          </Reasoning>
        </Message>
      )
    }

    return (
      <Message from="assistant">
        <ToolCallSteps
          className="animate-in duration-200 ease-out fade-in-0 slide-in-from-top-2 motion-reduce:animate-none"
          isStreaming={isMessageStreaming}
          messageId={message.id}
          onToolApprovalResponse={onToolApprovalResponse}
          toolInvocations={toolInvocations}
        />
      </Message>
    )
  }
)

// ============================================================================
// Message List Component
// ============================================================================

interface MessageListProps {
  messages: ChatMessage[]
  isPending: boolean
  thinkingEnabled: boolean
  onToolApprovalResponse?: ToolApprovalHandler
  onRegenerate?: () => void
}

export function MessageList({
  messages,
  isPending,
  thinkingEnabled,
  onToolApprovalResponse,
  onRegenerate
}: MessageListProps) {
  const { t } = useTranslation()

  // Derive waiting state from messages - show only when pending but no streaming content
  const showWaiting = useMemo(() => {
    if (!isPending) {
      return false
    }
    const hasToolParts = (message: ChatMessage) =>
      (message.parts ?? []).some(isToolInvocationPart)
    return !messages.some(
      (m) =>
        m.isStreaming &&
        (m.content.length > 0 ||
          (m.thinking?.length ?? 0) > 0 ||
          hasToolParts(m))
    )
  }, [isPending, messages])

  const hasMessages = messages.length > 0 || showWaiting

  return (
    <Conversation className="h-full">
      <ConversationContent className="gap-4 p-4">
        {hasMessages ? (
          <>
            {messages.map((message) => (
              <Fragment key={message.id}>
                {message.compactInfo ? (
                  <CompactMessage
                    compactInfo={message.compactInfo}
                    summary={message.content}
                  />
                ) : (
                  <>
                    <MessageProcess
                      message={message}
                      onToolApprovalResponse={onToolApprovalResponse}
                      thinkingEnabled={thinkingEnabled}
                    />
                    <MessageBubble
                      message={message}
                      onRegenerate={onRegenerate}
                    />
                  </>
                )}
              </Fragment>
            ))}
            {showWaiting ? <WaitingIndicator /> : null}
          </>
        ) : (
          <ConversationEmptyState
            description={t("knowledge.emptyState.description")}
            icon={
              <HugeiconsIcon
                className="size-12 text-muted-foreground/50"
                icon={AiBrain01Icon}
              />
            }
            title={t("knowledge.emptyState.title")}
          />
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
