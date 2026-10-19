import type { TranslateFunction } from "@folionote/editor-core"
import { Extension } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { toast } from "sonner"

/** Kana, not kanji: Chinese notes (kanji only) must not trigger the offer. */
const KANA = /[぀-ヿ]/
const MIN_PASTE_CHARS = 4
const OFFER_DURATION_MS = 8000
/** Sentence end, keeping the punctuation with its sentence. */
const SENTENCE_SPLIT = /(?<=[。！？!?])/

interface PendingRange {
  from: number
  to: number
}

const pasteOfferKey = new PluginKey<PendingRange | null>("japanesePasteOffer")

export function splitJapaneseSentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(SENTENCE_SPLIT))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

/** Paragraph text with hard breaks as newlines. */
function paragraphText(node: ProseMirrorNode): string {
  // Leaf text for hard breaks (the only leaf nodes inside a paragraph here).
  return node.textBetween(0, node.content.size, "\n", "\n")
}

/**
 * Replace every Japanese paragraph overlapping [from, to] with one analyzed
 * sentence block per sentence. Non-Japanese paragraphs are left alone.
 */
function convertRange(
  state: EditorState,
  range: PendingRange
): { tr: Transaction; count: number } | null {
  const sentenceType = state.schema.nodes.japaneseSentence
  if (!sentenceType) return null
  const targets: { pos: number; node: ProseMirrorNode }[] = []
  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (node.type.name === "paragraph") {
      if (KANA.test(node.textContent)) targets.push({ pos, node })
      return false
    }
    return true
  })
  if (targets.length === 0) return null

  const { tr } = state
  let count = 0
  // Back to front so earlier positions stay valid.
  for (const { pos, node } of targets.toReversed()) {
    const blocks = splitJapaneseSentences(paragraphText(node)).map((text) =>
      sentenceType.create({ text })
    )
    count += blocks.length
    tr.replaceWith(pos, pos + node.nodeSize, blocks)
  }
  return { tr, count }
}

export interface JapanesePasteOfferOptions {
  t: TranslateFunction
}

/**
 * After a paste containing Japanese, offer (in a toast) to turn the pasted
 * paragraphs into Mirra sentence blocks. The pasted range is kept in plugin
 * state and mapped through later edits, so the action still targets the
 * right text if the user keeps typing before clicking it.
 */
export const JapanesePasteOffer = Extension.create<JapanesePasteOfferOptions>({
  name: "japanesePasteOffer",

  addOptions() {
    return { t: (key: string) => key }
  },

  addProseMirrorPlugins() {
    const { t } = this.options
    return [
      new Plugin<PendingRange | null>({
        key: pasteOfferKey,
        state: {
          init: () => null,
          apply(tr, pending) {
            const meta = tr.getMeta(pasteOfferKey) as
              | PendingRange
              | null
              | undefined
            if (meta !== undefined) return meta
            if (!pending || !tr.docChanged) return pending
            return {
              from: tr.mapping.mapResult(pending.from, -1).pos,
              to: tr.mapping.mapResult(pending.to, 1).pos
            }
          }
        },
        props: {
          handlePaste(view, event) {
            const text = event.clipboardData?.getData("text/plain") ?? ""
            if (text.trim().length < MIN_PASTE_CHARS || !KANA.test(text)) {
              return false
            }
            const from = view.state.selection.from
            // Let the default paste run, then remember what it inserted.
            setTimeout(() => {
              const to = view.state.selection.to
              if (to <= from) return
              view.dispatch(view.state.tr.setMeta(pasteOfferKey, { from, to }))
              toast(t("editor.japaneseSentence.pasteOffer"), {
                duration: OFFER_DURATION_MS,
                action: {
                  label: t("editor.japaneseSentence.pasteConvert"),
                  onClick: () => {
                    const range = pasteOfferKey.getState(view.state)
                    const result = range && convertRange(view.state, range)
                    if (!result) return
                    result.tr.setMeta(pasteOfferKey, null)
                    view.dispatch(result.tr)
                    view.focus()
                  }
                }
              })
            }, 0)
            return false
          }
        }
      })
    ]
  }
})
