import { JapaneseSentence } from "@folionote/editor-core/extensions"
import type { Word } from "@folionote/japanese"
import { Button, Input, Label, TextArea, TextField } from "@heroui/react"
import { PencilEdit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import type { KeyboardEvent } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { JapaneseAnalyzedSentenceView } from "@/components/japanese/japanese-analyzed-sentence"
import { JapaneseBrowserEngineBanner } from "@/components/japanese/japanese-browser-engine-banner"
import {
  ReadingDisplayToggles,
  SentenceError,
  SentenceSkeleton
} from "@/components/japanese/japanese-reading-controls"
import { SelectedWordPanel } from "@/components/japanese/japanese-selected-word-panel"
import { useBrowserJapanese } from "@/hooks/use-browser-japanese"
import { ALL_JAPANESE_POS_CATEGORIES } from "@/lib/japanese-pos"
import {
  analyzeSentence,
  isServerUnavailable
} from "@/lib/japanese/analyze-sentence"
import { enableBrowserEngine } from "@/lib/japanese/browser-engine"

const ALL_POS = new Set(ALL_JAPANESE_POS_CATEGORIES)

interface SentenceDraft {
  text: string
  translation: string
}

function SentenceForm({
  initial,
  onSave,
  onCancel
}: {
  initial: SentenceDraft
  onSave: (draft: SentenceDraft) => void
  onCancel: (() => void) | null
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(initial)
  const canSave = draft.text.trim().length > 0

  const save = () => {
    if (canSave) {
      onSave({ text: draft.text.trim(), translation: draft.translation.trim() })
    }
  }
  // ⌘/Ctrl+Enter saves; never mid-IME-composition (Enter confirms kana → kanji).
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <TextField
        autoFocus
        onChange={(text) => setDraft((previous) => ({ ...previous, text }))}
        onKeyDown={handleKeyDown}
        value={draft.text}
      >
        <Label>{t("editor.japaneseSentence.textLabel")}</Label>
        <TextArea
          className="min-h-16 font-script-ja text-lg"
          lang="ja"
          placeholder="満員電車に揺られていた人"
        />
      </TextField>
      <TextField
        onChange={(translation) =>
          setDraft((previous) => ({ ...previous, translation }))
        }
        onKeyDown={handleKeyDown}
        value={draft.translation}
      >
        <Label>{t("editor.japaneseSentence.translationLabel")}</Label>
        <Input
          placeholder={t("editor.japaneseSentence.translationPlaceholder")}
        />
      </TextField>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button onPress={onCancel} size="sm" variant="ghost">
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          isDisabled={!canSave}
          onPress={save}
          size="sm"
          variant="primary"
        >
          {t("editor.japaneseSentence.analyze")}
        </Button>
      </div>
    </div>
  )
}

function SentenceAnalysis({
  text,
  translation,
  onEdit
}: {
  text: string
  translation: string | null
  onEdit: (() => void) | null
}) {
  const { t } = useTranslation()
  const engine = useBrowserJapanese()
  const [showFurigana, setShowFurigana] = useState(true)
  const [showRomaji, setShowRomaji] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const analysis = useQuery({
    queryKey: ["japanese", "sentence", text],
    queryFn: () => analyzeSentence(text),
    // The analysis is a pure function of text + dictionary; keep it.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false
  })
  const result = analysis.data?.analysis
  const selectedWord = selected === null ? undefined : result?.words[selected]

  const toggleWord = (word: Word) => {
    setSelected((previous) => (previous === word.index ? null : word.index))
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("editor.japaneseSentence.title")}
        </span>
        <div className="flex items-center gap-1.5">
          <ReadingDisplayToggles
            onToggleFurigana={() => setShowFurigana((value) => !value)}
            onToggleRomaji={() => setShowRomaji((value) => !value)}
            showFurigana={showFurigana}
            showRomaji={showRomaji}
          />
          {onEdit ? (
            <button
              aria-label={t("editor.japaneseSentence.edit")}
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              onClick={onEdit}
              type="button"
            >
              <HugeiconsIcon className="size-4" icon={PencilEdit02Icon} />
            </button>
          ) : null}
        </div>
      </div>

      {analysis.isPending ? <SentenceSkeleton /> : null}
      {analysis.isError ? (
        <>
          <SentenceError
            error={analysis.error}
            onRetry={() => {
              // refetch() resolves with the error state; it never rejects.
              analysis.refetch()
            }}
          />
          <JapaneseBrowserEngineBanner
            engine={engine}
            onEnable={() => {
              void enableBrowserEngine()
                .then(() => analysis.refetch())
                .catch(() => {
                  // The banner shows engine.error.
                })
            }}
            serverUnavailable={isServerUnavailable(analysis.error)}
          />
        </>
      ) : null}
      {result ? (
        <JapaneseAnalyzedSentenceView
          analysis={result}
          enabledPosCategories={ALL_POS}
          onSelectWord={toggleWord}
          selectedWordIndex={selected}
          showFurigana={showFurigana}
          showRomaji={showRomaji}
          unit="word"
        />
      ) : null}

      {translation ? (
        <p className="text-sm text-muted-foreground">{translation}</p>
      ) : null}

      {selectedWord && result ? (
        <SelectedWordPanel analysis={result} word={selectedWord} />
      ) : null}
    </div>
  )
}

function JapaneseSentenceView({
  node,
  updateAttributes,
  editor,
  selected
}: NodeViewProps) {
  const text = (node.attrs.text as string | undefined) ?? ""
  const translation = (node.attrs.translation as string | null) ?? null
  const [isEditing, setIsEditing] = useState(text === "")
  const canEdit = editor.isEditable

  return (
    <NodeViewWrapper
      className="japanese-sentence-block my-4 rounded-xl border border-border bg-surface/40 data-[selected=true]:ring-2 data-[selected=true]:ring-focus"
      contentEditable={false}
      data-selected={selected}
    >
      {canEdit && isEditing ? (
        <SentenceForm
          initial={{ text, translation: translation ?? "" }}
          onCancel={text ? () => setIsEditing(false) : null}
          onSave={(draft) => {
            updateAttributes({
              text: draft.text,
              translation: draft.translation || null
            })
            setIsEditing(false)
          }}
        />
      ) : null}
      {!isEditing && text ? (
        <SentenceAnalysis
          onEdit={canEdit ? () => setIsEditing(true) : null}
          text={text}
          translation={translation}
        />
      ) : null}
    </NodeViewWrapper>
  )
}

/** Web editor flavour of the shared schema node: adds the analyzed view. */
export const JapaneseSentenceBlock = JapaneseSentence.extend({
  addNodeView() {
    return ReactNodeViewRenderer(JapaneseSentenceView)
  }
})
