import { AiBrain01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import type { CompactInfo } from "../types"

interface CompactMessageProps {
  compactInfo: CompactInfo
  summary: string
}

export const CompactMessage = memo(
  ({ compactInfo, summary }: CompactMessageProps) => {
    const { t } = useTranslation()
    const [isExpanded, setIsExpanded] = useState(false)
    const compactedAtLabel = useMemo(() => {
      const compactedAtDate = new Date(compactInfo.compactedAt)
      if (Number.isNaN(compactedAtDate.getTime())) {
        return t("knowledge.compactMessage.justNow")
      }
      return compactedAtDate.toLocaleTimeString()
    }, [compactInfo.compactedAt, t])

    return (
      <div className="my-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-px flex-1 bg-border/60" />
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs",
              "border border-border/60 bg-surface-secondary/40 hover:bg-surface-secondary/70",
              "transition-colors motion-reduce:transition-none"
            )}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            type="button"
          >
            <HugeiconsIcon className="size-3.5" icon={AiBrain01Icon} />
            <span>
              {t("knowledge.compactMessage.title", {
                count: compactInfo.compactedMessageCount
              })}
            </span>
          </button>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          {t("knowledge.compactMessage.meta", {
            kept: compactInfo.keptMessageCount,
            time: compactedAtLabel
          })}
        </p>
        {isExpanded ? (
          <div
            className={cn(
              "mt-2 rounded-lg border border-border/60",
              "bg-card/60 px-3 py-2",
              "text-muted-foreground text-xs"
            )}
          >
            <p className="font-medium text-foreground">
              {t("knowledge.compactMessage.summaryLabel")}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{summary}</p>
          </div>
        ) : null}
      </div>
    )
  }
)
