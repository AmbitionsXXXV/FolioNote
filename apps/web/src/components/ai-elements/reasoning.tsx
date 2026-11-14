import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@folionote/ui/collapsible"
import { cn } from "@folionote/ui/lib/utils"
import { ArrowDown01Icon, BrainIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps, ReactNode } from "react"
import { createContext, memo, use, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Streamdown } from "streamdown"

import { useUncontrolled } from "@/hooks/use-uncontrolled"

import { Shimmer } from "./shimmer"

interface ReasoningContextValue {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = use(ReasoningContext)
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning")
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useUncontrolled({
      value: open,
      defaultValue: defaultOpen,
      onChange: onOpenChange
    })
    const [duration, setDuration] = useUncontrolled({
      value: durationProp,
      defaultValue: undefined
    })

    const [hasAutoClosed, setHasAutoClosed] = useState(false)
    const [startTime, setStartTime] = useState<number | null>(null)
    const userInteractedRef = useRef(false)

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now())
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
        setStartTime(null)
      }
    }, [isStreaming, startTime, setDuration])

    // Auto-open when streaming starts, reset interaction flag for new session
    useEffect(() => {
      if (isStreaming) {
        userInteractedRef.current = false
        setHasAutoClosed(false)
        if (!isOpen) {
          setIsOpen(true)
        }
      }
    }, [isStreaming, isOpen, setIsOpen])

    // Auto-close when streaming ends (once only), skip if user manually toggled
    useEffect(() => {
      if (
        !isStreaming &&
        isOpen &&
        !hasAutoClosed &&
        !userInteractedRef.current
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false)
          setHasAutoClosed(true)
        }, AUTO_CLOSE_DELAY)

        return () => clearTimeout(timer)
      }
    }, [isStreaming, isOpen, setIsOpen, hasAutoClosed])

    const handleOpenChange = (newOpen: boolean) => {
      userInteractedRef.current = true
      setIsOpen(newOpen)
    }

    return (
      <ReasoningContext value={{ isStreaming, isOpen, setIsOpen, duration }}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext>
    )
  }
)

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode
}

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { t } = useTranslation()
    const { isStreaming, isOpen, duration } = useReasoning()
    const fallbackMessage =
      getThinkingMessage ??
      ((streaming: boolean, reasoningDuration?: number) =>
        defaultGetThinkingMessage(t, streaming, reasoningDuration))

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground motion-reduce:transition-none",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <HugeiconsIcon className="size-4" icon={BrainIcon} />
            {fallbackMessage(isStreaming, duration)}
            <HugeiconsIcon
              className={cn(
                "size-4 transition-transform motion-reduce:transition-none",
                isOpen ? "rotate-180" : "rotate-0"
              )}
              icon={ArrowDown01Icon}
            />
          </>
        )}
      </CollapsibleTrigger>
    )
  }
)

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string
}

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        "motion-reduce:animate-none motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <Streamdown>{children}</Streamdown>
    </CollapsibleContent>
  )
)

Reasoning.displayName = "Reasoning"
ReasoningTrigger.displayName = "ReasoningTrigger"
ReasoningContent.displayName = "ReasoningContent"

function defaultGetThinkingMessage(
  t: (key: string, options?: Record<string, number>) => string,
  isStreaming: boolean,
  duration?: number
): ReactNode {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>{t("knowledge.reasoning.thinking")}</Shimmer>
  }
  if (duration === undefined) {
    return <p>{t("knowledge.reasoning.thoughtFewSeconds")}</p>
  }
  return (
    <p>
      {t("knowledge.reasoning.thoughtSeconds", {
        count: duration
      })}
    </p>
  )
}
