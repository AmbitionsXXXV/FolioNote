import { Copy01Icon, RefreshIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"

import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource
} from "@/components/ai-elements/inline-citation"
import { renderTextWithMentions } from "@/components/ai-elements/mention-badge"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger
} from "@/components/ai-elements/sources"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse
} from "@/components/chat-message"
import { cn } from "@/lib/utils"

import type { ChatMessage, CitationSource } from "../types"
import { formatCost, formatTokenCount } from "../utils"
import { GeneratedImagesGrid } from "./generated-image"
import {
  extractGeneratedImagesFromTools,
  extractWebSearchData,
  isDisplayWeatherPart,
  isStockPricePart,
  isStockTrendPart,
  StockToolCard,
  StockTrendToolCard,
  WeatherToolCard,
  WebSearchToolCard
} from "./tool-cards"

// ============================================================================
// Message Footer Component
// ============================================================================

interface MessageFooterProps {
  timestamp: Date
  outputTokens: string | null
  costDisplay: string | null
  isUser: boolean
}

const MessageFooter = memo(
  ({ timestamp, outputTokens, costDisplay, isUser }: MessageFooterProps) => {
    return (
      <div
        className={cn(
          "mt-1 flex items-center gap-2 font-[tabular-nums] text-[10px]",
          isUser ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        <span>{timestamp.toLocaleTimeString()}</span>
        {outputTokens ? (
          <span className="opacity-60">• {outputTokens} tokens</span>
        ) : null}
        {costDisplay ? (
          <span className="opacity-60">• {costDisplay}</span>
        ) : null}
      </div>
    )
  }
)

// ============================================================================
// Citation Badge Component
// ============================================================================

interface CitationBadgeProps {
  citations: CitationSource[]
}

const CitationBadge = memo(({ citations }: CitationBadgeProps) => {
  if (citations.length === 0) return null

  const sources = citations.map((c) => c.url)

  return (
    <InlineCitation>
      <InlineCitationCard>
        <InlineCitationCardTrigger sources={sources} />
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselHeader>
              <InlineCitationCarouselPrev />
              <InlineCitationCarouselIndex />
              <InlineCitationCarouselNext />
            </InlineCitationCarouselHeader>
            <InlineCitationCarouselContent>
              {citations.map((citation) => (
                <InlineCitationCarouselItem key={citation.id}>
                  <InlineCitationSource
                    description={citation.description}
                    title={citation.title}
                    url={citation.url}
                  />
                  {citation.quote ? (
                    <InlineCitationQuote>{citation.quote}</InlineCitationQuote>
                  ) : null}
                </InlineCitationCarouselItem>
              ))}
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  )
})

// ============================================================================
// Content Components
// ============================================================================

interface UserMessageContentProps {
  content: string
  mentionTitles?: string[]
}

const UserMessageContent = memo(
  ({ content, mentionTitles }: UserMessageContentProps) => {
    return (
      <p className="text-sm text-pretty whitespace-pre-wrap">
        {renderTextWithMentions(content, "user-message", mentionTitles)}
      </p>
    )
  }
)

interface AssistantMessageContentProps {
  content: string
  isStreaming?: boolean
  citations?: CitationSource[]
}

const AssistantMessageContent = memo(
  ({
    content,
    isStreaming = false,
    citations
  }: AssistantMessageContentProps) => {
    const hasCitations = citations && citations.length > 0

    return (
      <div
        aria-busy={isStreaming}
        aria-live={isStreaming ? "polite" : "off"}
        className={cn(
          "streamdown-content prose prose-sm dark:prose-invert max-w-none text-sm motion-reduce:animate-none",
          isStreaming && "streaming-cursor"
        )}
      >
        <MessageResponse isAnimating={isStreaming}>{content}</MessageResponse>
        {hasCitations ? <CitationBadge citations={citations} /> : null}
      </div>
    )
  },
  (prevProps, nextProps) =>
    prevProps.content === nextProps.content &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.citations === nextProps.citations
)

// ============================================================================
// Message Bubble Component
// ============================================================================

function extractGeneratedImages(parts: MessagePart[]) {
  const fileParts = parts.filter(isImageFilePart).map((part) => ({
    url: part.url,
    mediaType: part.mediaType
  }))
  const toolImages = extractGeneratedImagesFromTools(parts)
  return [...fileParts, ...toolImages]
}

function hasToolCardPart(parts: MessagePart[]) {
  return parts.some(
    (part) =>
      isDisplayWeatherPart(part) ||
      isStockPricePart(part) ||
      isStockTrendPart(part)
  )
}

function deriveBubbleState(message: ChatMessage) {
  const isUser = message.role === "user"
  const messageParts = message.parts ?? []
  const hasAssistantContent = message.content.length > 0
  const sources = messageParts.filter(isSourceUrlPart)
  const webSearchData = isUser ? null : extractWebSearchData(messageParts)
  const generatedImages = isUser ? [] : extractGeneratedImages(messageParts)
  const hasToolCards = !isUser && hasToolCardPart(messageParts)
  const shouldRender =
    isUser ||
    hasAssistantContent ||
    hasToolCards ||
    webSearchData !== null ||
    generatedImages.length > 0

  return {
    isUser,
    messageParts,
    hasAssistantContent,
    sources,
    webSearchData,
    generatedImages,
    hasToolCards,
    shouldRender
  }
}

interface MessageBubbleProps {
  message: ChatMessage
  onRegenerate?: () => void
}

export const MessageBubble = memo(
  ({ message, onRegenerate }: MessageBubbleProps) => {
    const { t } = useTranslation()
    const state = deriveBubbleState(message)
    const isMessageStreaming = Boolean(message.isStreaming)

    const outputTokens = formatTokenCount(message.usage?.outputTokens)
    const costDisplay = formatCost(message.usage?.costUSD)
    const showFooter = !isMessageStreaming
    const showActions = !state.isUser && state.hasAssistantContent

    const handleCopy = useCallback(() => {
      if (!state.hasAssistantContent) return
      if (!navigator.clipboard?.writeText) return
      navigator.clipboard.writeText(message.content)
    }, [state.hasAssistantContent, message.content])

    const handleRegenerate = useCallback(() => {
      onRegenerate?.()
    }, [onRegenerate])

    if (!state.shouldRender) {
      return null
    }

    const {
      isUser,
      sources,
      webSearchData,
      generatedImages,
      hasToolCards,
      messageParts
    } = state
    const hasSources = sources.length > 0
    const hasGeneratedImages = generatedImages.length > 0

    return (
      <Message from={message.role}>
        <MessageContent
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2 shadow-sm",
            "fade-in-0 slide-in-from-bottom-2 animate-in duration-200 ease-out",
            "motion-reduce:animate-none motion-reduce:transition-none",
            isUser
              ? "bg-primary/90 text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              : "border border-border/60 bg-card/80 text-card-foreground backdrop-blur-sm"
          )}
        >
          {!isUser && hasSources ? (
            <Sources>
              <SourcesTrigger count={sources.length} />
              <SourcesContent>
                {sources.map((source, index) => (
                  <Source
                    href={source.url}
                    key={getSourceKey(message.id, source, index)}
                    title={source.title ?? source.url}
                  />
                ))}
              </SourcesContent>
            </Sources>
          ) : null}

          {isUser ? (
            <UserMessageContent
              content={message.content}
              mentionTitles={message.mentionTitles}
            />
          ) : null}
          {!isUser && webSearchData ? (
            <WebSearchToolCard webSearchData={webSearchData} />
          ) : null}
          {!isUser && state.hasAssistantContent ? (
            <AssistantMessageContent
              citations={message.citations}
              content={message.content}
              isStreaming={isMessageStreaming}
            />
          ) : null}

          {hasGeneratedImages ? (
            <GeneratedImagesGrid
              images={generatedImages}
              messageId={message.id}
            />
          ) : null}

          {!isUser && hasToolCards ? (
            <div className="mt-2 grid gap-2">
              {messageParts.map((part) => {
                const fallbackState =
                  "state" in part && typeof part.state === "string"
                    ? part.state
                    : "tool"
                const toolKey =
                  "toolCallId" in part && typeof part.toolCallId === "string"
                    ? part.toolCallId
                    : `${message.id}-${part.type}-${fallbackState}`
                if (isDisplayWeatherPart(part)) {
                  return (
                    <WeatherToolCard key={`weather-${toolKey}`} part={part} />
                  )
                }
                if (isStockPricePart(part)) {
                  return <StockToolCard key={`stock-${toolKey}`} part={part} />
                }
                if (isStockTrendPart(part)) {
                  return (
                    <StockTrendToolCard
                      key={`stock-trend-${toolKey}`}
                      part={part}
                    />
                  )
                }
                return null
              })}
            </div>
          ) : null}

          {showFooter ? (
            <MessageFooter
              costDisplay={costDisplay}
              isUser={isUser}
              outputTokens={outputTokens}
              timestamp={message.timestamp}
            />
          ) : null}

          {showActions ? (
            <MessageActions className="mt-2 justify-end">
              <MessageAction
                className="transition-colors duration-200 hover:bg-surface-secondary/80 motion-reduce:transition-none"
                disabled={!onRegenerate || isMessageStreaming}
                label={t("knowledge.messageActions.retry")}
                onClick={handleRegenerate}
                tooltip={t("knowledge.messageActions.retry")}
              >
                <HugeiconsIcon icon={RefreshIcon} size={14} />
              </MessageAction>
              <MessageAction
                className="transition-colors duration-200 hover:bg-surface-secondary/80 motion-reduce:transition-none"
                disabled={isMessageStreaming}
                label={t("knowledge.messageActions.copy")}
                onClick={handleCopy}
                tooltip={t("knowledge.messageActions.copy")}
              >
                <HugeiconsIcon icon={Copy01Icon} size={14} />
              </MessageAction>
            </MessageActions>
          ) : null}
        </MessageContent>
      </Message>
    )
  }
)

type MessagePart = NonNullable<ChatMessage["parts"]>[number]

type ImageFilePart = MessagePart & {
  type: "file"
  mediaType: string
  url: string
}

function isImageFilePart(part: MessagePart): part is ImageFilePart {
  return (
    Boolean(part) &&
    typeof part === "object" &&
    "type" in part &&
    part.type === "file" &&
    "mediaType" in part &&
    typeof part.mediaType === "string" &&
    part.mediaType.startsWith("image/") &&
    "url" in part &&
    typeof part.url === "string"
  )
}

type SourceUrlPart = MessagePart & {
  type: "source-url"
  url: string
  title?: string
}

const SOURCE_URL_PART_TYPE = "source-url"

function isSourceUrlPart(part: MessagePart): part is SourceUrlPart {
  return (
    Boolean(part) &&
    typeof part === "object" &&
    "type" in part &&
    part.type === SOURCE_URL_PART_TYPE &&
    "url" in part &&
    typeof part.url === "string"
  )
}

function getSourceKey(
  messageId: string,
  source: SourceUrlPart,
  index: number
): string {
  return `${messageId}-source-${source.url}-${index}`
}
