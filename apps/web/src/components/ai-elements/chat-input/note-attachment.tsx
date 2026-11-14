import { Button } from "@folionote/ui/button"
import { HoverCardTrigger } from "@folionote/ui/hover-card"
import { Cancel01Icon, FileEditIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

import {
  PromptInputHoverCard,
  PromptInputHoverCardContent
} from "@/components/ai-elements/prompt-input"

import type { AttachedNote } from "./types"

export interface NoteAttachmentProps {
  note: AttachedNote
  onRemove?: (noteId: string) => void
}

export function NoteAttachment({ note, onRemove }: NoteAttachmentProps) {
  const { t } = useTranslation()
  const displayTitle = note.title || t("entryPicker.untitled")

  return (
    <PromptInputHoverCard>
      <HoverCardTrigger>
        <div className="group relative flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-1.5 text-sm font-medium transition-all select-none hover:bg-surface-secondary hover:text-foreground dark:hover:bg-surface-secondary/50">
          <div className="relative size-5 shrink-0">
            <div className="absolute inset-0 flex size-5 items-center justify-center overflow-hidden rounded bg-background transition-opacity group-hover:opacity-0">
              <div className="flex size-5 items-center justify-center text-muted-foreground">
                <HugeiconsIcon icon={FileEditIcon} size={12} />
              </div>
            </div>
            {onRemove && (
              <Button
                aria-label={t("knowledge.removeAttachment")}
                className="absolute inset-0 size-5 cursor-pointer rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [&>svg]:size-2.5"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(note.id)
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon icon={Cancel01Icon} />
                <span className="sr-only">
                  {t("knowledge.removeAttachment")}
                </span>
              </Button>
            )}
          </div>
          <span className="max-w-[150px] flex-1 truncate">{displayTitle}</span>
        </div>
      </HoverCardTrigger>
      <PromptInputHoverCardContent className="w-auto p-2">
        <div className="w-auto space-y-1 px-0.5">
          <h4 className="max-w-64 truncate text-sm leading-none font-semibold">
            {displayTitle}
          </h4>
          <p className="font-mono text-xs text-muted-foreground">
            {t("knowledge.noteAttachment")}
          </p>
        </div>
      </PromptInputHoverCardContent>
    </PromptInputHoverCard>
  )
}
