import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Alert } from "react-native"

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
      context?: { sentence: string }
    }

function meaningLanguageFor(language: string): MeaningLanguage {
  if (language.startsWith("ja")) return "ja"
  if (language.startsWith("en")) return "en"
  return "zh"
}

/**
 * Toggles a word in the reader's 生词本. `lookupForm` is the dictionary form
 * the notebook files it under (the headword for word-bank words).
 */
export function JapaneseNotebookButton({
  word,
  lookupForm,
  className
}: {
  word: NotebookWord
  lookupForm: string
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const lookup = useQuery({
    ...orpc.japanese.lexicons.lookup.queryOptions({
      input: { baseForms: [lookupForm] }
    }),
    meta: { silentError: true }
  })
  const savedEntryId =
    lookup.data?.find(
      (match) =>
        match.lexiconKind === "notebook" && match.baseForm === lookupForm
    )?.entryId ?? null

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.japanese.lexicons.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.japanese.study.key() })
    ])
  const save = useMutation(
    orpc.japanese.notebook.save.mutationOptions({
      onSuccess: refresh,
      onError: () => {
        Alert.alert(t("common.error"), t("japanese.notebook.saveFailed"))
      }
    })
  )
  const remove = useMutation(
    orpc.japanese.notebook.remove.mutationOptions({
      onSuccess: refresh,
      onError: () => {
        Alert.alert(t("common.error"), t("japanese.notebook.removeFailed"))
      }
    })
  )

  const isSaved = savedEntryId !== null
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
      accessibilityHint={isSaved ? t("japanese.notebook.remove") : undefined}
      accessibilityState={{ selected: isSaved }}
      className={className}
      isDisabled={lookup.isPending || save.isPending || remove.isPending}
      onPress={handlePress}
      variant={isSaved ? "secondary" : "primary"}
    >
      <Button.Label>
        {isSaved ? t("japanese.notebook.saved") : t("japanese.notebook.save")}
      </Button.Label>
    </Button>
  )
}
