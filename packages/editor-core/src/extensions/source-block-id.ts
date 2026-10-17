import { Extension } from "@tiptap/core"

/** Top-level block types an import can produce. */
export const SOURCE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "table",
  "image",
  "horizontalRule",
  "japaneseSentence"
]

/**
 * Which source block (a Notion block id) an imported top-level node came
 * from. Pull sync matches blocks by it: nodes that carry it are replaced
 * when the source changes; nodes without it are the user's own and stay.
 *
 * keepOnSplit: false — the half created by pressing Enter inside an
 * imported paragraph is the user's, not the source's.
 */
export const SourceBlockId = Extension.create({
  name: "sourceBlockId",

  addGlobalAttributes() {
    return [
      {
        types: SOURCE_BLOCK_TYPES,
        attributes: {
          sourceBlockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.dataset.sourceBlockId ?? null,
            renderHTML: (attributes) =>
              attributes.sourceBlockId
                ? { "data-source-block-id": attributes.sourceBlockId }
                : {}
          }
        }
      }
    ]
  }
})
