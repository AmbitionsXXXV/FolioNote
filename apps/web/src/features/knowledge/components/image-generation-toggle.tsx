import { Tooltip, TooltipContent, TooltipTrigger } from "@folionote/ui/tooltip"
import { Image01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

interface ImageGenerationToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
}

export function ImageGenerationToggle({
  enabled,
  onToggle,
  disabled = false
}: ImageGenerationToggleProps) {
  const { t } = useTranslation()

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={t("knowledge.toggleImageGeneration")}
        aria-pressed={enabled}
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-lg",
          "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "transition-all duration-200 ease-out active:scale-95 motion-reduce:transition-none",
          enabled &&
            "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
        )}
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        type="button"
      >
        <HugeiconsIcon className="size-4" icon={Image01Icon} />
        {enabled ? (
          <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" />
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>
          {enabled
            ? t("knowledge.imageGenerationEnabled", {
                defaultValue: "Image Generation Enabled"
              })
            : t("knowledge.enableImageGeneration", {
                defaultValue: "Enable Image Generation"
              })}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
