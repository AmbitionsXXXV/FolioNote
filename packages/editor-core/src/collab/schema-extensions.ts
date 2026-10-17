import { Extension } from "@tiptap/core"
import CodeBlock from "@tiptap/extension-code-block"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import { Table } from "@tiptap/extension-table"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableRow } from "@tiptap/extension-table-row"
import StarterKit from "@tiptap/starter-kit"

import { JapaneseSentence } from "../extensions/japanese-sentence"
import { SourceBlockId } from "../extensions/source-block-id"

/**
 * DOM-free mirror of the web editor's schema (apps/web/src/components/
 * entry-editor.tsx), for server-side use with Hocuspocus's
 * `TiptapTransformer`. The transformer only needs the ProseMirror schema
 * (node/mark types and their attributes) to convert between ProseMirror
 * JSON and a Y.Doc — it never mounts a live editor — so every extension
 * here drops the client's React NodeViews (Shiki highlighting, table
 * resize handles, image resize handles) and keeps only the attributes
 * that are actually part of the document JSON.
 *
 * When the web editor's extension list changes, mirror the change here
 * too: a node/mark/attribute missing from this list is silently dropped
 * by `TiptapTransformer.toYdoc`/`fromYdoc` (schema-invalid content is
 * stripped, not preserved), which is exactly the kind of data loss that
 * "it type-checked" won't catch.
 *
 * Deliberately omitted — verified to add no schema/attributes, so nothing
 * to mirror: HeadingIds, Placeholder, PasteHandler, the inline imageUpload
 * extension, the slash-command extension, CustomCaret.
 */

/**
 * Schema-only mirror of `FoldableHeadings` (@folionote/editor-react). That
 * extension's fold-toggle/decoration logic touches `document` and can't be
 * imported here — editor-core sits below editor-react in the dependency
 * graph — but the `collapsed` attribute it adds to headings is document
 * state and must round-trip through the Y.Doc.
 */
const FoldableHeadingsSchema = Extension.create({
  name: "foldableHeadings",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          collapsed: {
            default: false,
            keepOnSplit: false,
            parseHTML: (element) => element.dataset.collapsed === "true",
            renderHTML: (attributes) =>
              attributes.collapsed ? { "data-collapsed": "true" } : {}
          }
        }
      }
    ]
  }
})

/**
 * Schema-only mirror of `ResizableImage`
 * (apps/web/src/components/editor/resizable-image.ts) — same persisted
 * `width` attribute, no React NodeView.
 */
const ImageSchema = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("width") ?? element.style.width
          if (!raw) {
            return null
          }
          const parsed = Number.parseInt(raw, 10)
          return Number.isFinite(parsed) ? parsed : null
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: attributes.width } : {}
      }
    }
  }
})

/**
 * Schema-only mirrors of `CustomTableCell` / `CustomTableHeader`
 * (@folionote/editor-react/extensions/table-extension) — same
 * backgroundColor/textAlign attributes (duplicated between the two exactly
 * as the source duplicates them), no React NodeView (that lives only on
 * `CustomTable`, not on the cell/header nodes).
 */
const TableCellSchema = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.dataset.backgroundColor,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {}
          }
          return {
            "data-background-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`
          }
        }
      },
      textAlign: {
        default: "left",
        parseHTML: (element) => element.dataset.textAlign || "left",
        renderHTML: (attributes) => {
          if (!attributes.textAlign || attributes.textAlign === "left") {
            return {}
          }
          return {
            "data-text-align": attributes.textAlign,
            style: `text-align: ${attributes.textAlign}`
          }
        }
      }
    }
  }
})

const TableHeaderSchema = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.dataset.backgroundColor,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {}
          }
          return {
            "data-background-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`
          }
        }
      },
      textAlign: {
        default: "left",
        parseHTML: (element) => element.dataset.textAlign || "left",
        renderHTML: (attributes) => {
          if (!attributes.textAlign || attributes.textAlign === "left") {
            return {}
          }
          return {
            "data-text-align": attributes.textAlign,
            style: `text-align: ${attributes.textAlign}`
          }
        }
      }
    }
  }
})

/**
 * Extension list for `TiptapTransformer.toYdoc` / `fromYdoc` on the collab
 * server. Options that only affect editing behavior (undo history, paste
 * strategy, link click/autolink validation) are intentionally not set here
 * — the transformer builds a schema, not a live editor, so they have
 * nothing to act on. Options that affect an attribute's *default value*
 * (`defaultLanguage` below) do matter and must match the client.
 */
export const COLLAB_SCHEMA_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
    link: false
  }),
  CodeBlock.configure({ defaultLanguage: "plaintext" }),
  FoldableHeadingsSchema,
  Table,
  TableCellSchema,
  TableHeaderSchema,
  TableRow,
  Link,
  ImageSchema,
  // Already DOM-free; the web editor only adds a React NodeView on top.
  JapaneseSentence,
  // Pull-sync anchor on imported blocks (see source-block-id.ts)
  SourceBlockId
]
