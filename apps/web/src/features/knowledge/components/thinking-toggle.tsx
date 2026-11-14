import { Tooltip, TooltipContent, TooltipTrigger } from "@folionote/ui/tooltip"
import { AiBrain01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

interface ThinkingToggleProps {
  thinkingActive: boolean
  thinkingEnabled: boolean
  hasToggleableReasoning: boolean
  onToggle: (enabled: boolean) => void
}

export function ThinkingToggle({
  thinkingActive,
  thinkingEnabled,
  hasToggleableReasoning,
  onToggle
}: ThinkingToggleProps) {
  const { t } = useTranslation()

  const getTooltip = () => {
    if (hasToggleableReasoning) {
      return thinkingEnabled
        ? t("knowledge.thinkingEnabled")
        : t("knowledge.enableThinking")
    }
    return t("knowledge.thinkingBuiltIn")
  }

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={t("knowledge.toggleThinking")}
        aria-pressed={thinkingActive}
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-lg",
          "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "transition-all duration-200 ease-out active:scale-95 motion-reduce:transition-none",
          thinkingActive &&
            "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
        )}
        disabled={!hasToggleableReasoning}
        onClick={() => hasToggleableReasoning && onToggle(!thinkingEnabled)}
        type="button"
      >
        <HugeiconsIcon className="size-4" icon={AiBrain01Icon} />
        {thinkingActive ? (
          <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" />
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{getTooltip()}</p>
      </TooltipContent>
    </Tooltip>
  )
}
