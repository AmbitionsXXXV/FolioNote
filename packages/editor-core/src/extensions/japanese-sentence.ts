import { mergeAttributes, Node } from "@tiptap/core"

export interface JapaneseSentenceAttributes {
  /** The Japanese sentence; segmentation is computed when rendered, never stored. */
  text: string
  /** Optional gloss shown under the tokens (e.g. a Chinese translation). */
  translation: string | null
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    japaneseSentence: {
      insertJapaneseSentence: (
        attributes?: Partial<JapaneseSentenceAttributes>
      ) => ReturnType
    }
  }
}

/**
 * Mirra-style analyzed sentence block (furigana · POS underline · romaji).
 *
 * Schema-only and DOM-free: the web editor adds its React NodeView on top
 * (`.extend({ addNodeView })`), while the collab server and the native editor
 * use it as-is so the block round-trips instead of being stripped as unknown
 * content. Only the text is persisted — analysis depends on the engine and
 * dictionary version, so storing it would go stale.
 */
export const JapaneseSentence = Node.create({
  name: "japaneseSentence",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) =>
          element.dataset.text ?? element.textContent ?? "",
        renderHTML: (attributes) => ({ "data-text": attributes.text })
      },
      translation: {
        default: null,
        parseHTML: (element) => element.dataset.translation ?? null,
        renderHTML: (attributes) =>
          attributes.translation
            ? { "data-translation": attributes.translation }
            : {}
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="japanese-sentence"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "japanese-sentence",
        lang: "ja"
      }),
      node.attrs.text
    ]
  },

  renderText({ node }) {
    return node.attrs.text
  },

  addCommands() {
    return {
      insertJapaneseSentence:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes })
    }
  }
})
