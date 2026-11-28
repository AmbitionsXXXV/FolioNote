import { Button } from "@folionote/ui/button"
import {
  BookmarkAdd01Icon,
  BookmarkCheck01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { orpc } from "@/utils/orpc"

type SaveInput = Parameters<typeof orpc.japanese.notebook.save.call>[0]
type MeaningLanguage = SaveInput["meaningLanguage"]
export type NotebookWord =
  | { vocabId: string }
  | {
      headword: string
      reading?: string | null
      baseForm: string
      pos?: string | null
      context?: {
        sentence: string
        articleId?: string
        materialId?: string
        timeMs?: number
      }
    }

export function meaningLanguageFor(language: string): MeaningLanguage {
  if (language.startsWith("ja")) return "ja"
  if (language.startsWith("en")) return "en"
  return "zh"
}

/**
 * Toggles a word in the reader's 生词本. `savedEntryId` comes from the
 * lexicon lookup; saving refreshes that lookup, the lists and study decks.
 */
export function JapaneseNotebookButton({
  word,
  savedEntryId
}: {
  word: NotebookWord
  savedEntryId: number | null
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.japanese.lexicons.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.japanese.notebook.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.japanese.study.key() })
    ])

  const save = useMutation(
    orpc.japanese.notebook.save.mutationOptions({
      onSuccess: async () => {
        await refresh()
        toast.success(t("japanese.notebook.savedToast"))
      },
      onError: () => {
        toast.error(t("japanese.notebook.saveFailed"))
      }
    })
  )
  const remove = useMutation(
    orpc.japanese.notebook.remove.mutationOptions({
      onSuccess: async () => {
        await refresh()
        toast.success(t("japanese.notebook.removedToast"))
      },
      onError: () => {
        toast.error(t("japanese.notebook.removeFailed"))
      }
    })
  )

  const isSaved = savedEntryId !== null
  const isPending = save.isPending || remove.isPending

  const handlePress = () => {
    if (savedEntryId !== null) {
      remove.mutate({ entryId: savedEntryId })
      return
    }
    save.mutate({
      ...word,
      meaningLanguage: meaningLanguageFor(
        i18n.resolvedLanguage ?? i18n.language
      )
    })
  }

  return (
    <Button
      aria-label={
        isSaved ? t("japanese.notebook.remove") : t("japanese.notebook.save")
      }
      aria-pressed={isSaved}
      className={isSaved ? "text-primary" : undefined}
      disabled={isPending}
      onClick={handlePress}
      size="sm"
      type="button"
      variant="outline"
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={isSaved ? BookmarkCheck01Icon : BookmarkAdd01Icon}
      />
      {isSaved ? t("japanese.notebook.saved") : t("japanese.notebook.save")}
    </Button>
  )
}
