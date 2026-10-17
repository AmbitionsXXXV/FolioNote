import type {
  ConvertOptions,
  ImportedDoc,
  ImportWarning,
  PMMark,
  PMNode
} from "./types"
import { assertValidDoc, emptyDoc, getImportSchema } from "./validate"

export function textNodes(value: string, marks: PMMark[] = []): PMNode[] {
  const schema = getImportSchema()
  let normalized: ReturnType<typeof schema.mark>[] = []
  for (const mark of marks) {
    normalized = [...schema.mark(mark.type, mark.attrs).addToSet(normalized)]
  }
  const content: PMNode[] = []
  for (const [index, text] of value.split("\n").entries()) {
    if (index > 0) content.push({ type: "hardBreak" })
    if (text) {
      content.push({
        type: "text",
        text,
        ...(normalized.length
          ? { marks: normalized.map((mark) => mark.toJSON()) }
          : {})
      })
    }
  }
  return content
}

export function paragraph(content: PMNode[] = []): PMNode {
  return { type: "paragraph", content }
}

/** Split around block images instead of putting them in an inline-only parent. */
export function inlineBlocks(
  content: PMNode[],
  type = "paragraph",
  attrs?: Record<string, unknown>
): PMNode[] {
  const blocks: PMNode[] = []
  let inline: PMNode[] = []
  const flush = (): void => {
    if (inline.length)
      blocks.push({ type, ...(attrs ? { attrs } : {}), content: inline })
    inline = []
  }
  for (const node of content) {
    if (getImportSchema().nodes[node.type]?.isBlock) {
      flush()
      blocks.push(node)
    } else {
      inline.push(node)
    }
  }
  flush()
  return blocks.length
    ? blocks
    : [{ type, ...(attrs ? { attrs } : {}), content: [] }]
}

export function imageNode(
  src: string,
  options: ConvertOptions,
  alt = "",
  title: string | null = null
): PMNode {
  return {
    type: "image",
    attrs: { src: options.mapImageUrl?.(src) ?? src, alt, title }
  }
}

/**
 * Fence / Notion names → the ids in the editor's language picker
 * (packages/editor-react code-block-view LANGUAGE_OPTIONS), so imported
 * blocks don't show up as "Plain Text".
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
  "c#": "csharp",
  golang: "go",
  "plain text": "plaintext",
  text: "plaintext"
}

export function codeBlock(text: string, language = "plaintext"): PMNode {
  const normalized = language.trim().toLowerCase()
  return {
    type: "codeBlock",
    attrs: {
      language: LANGUAGE_ALIASES[normalized] ?? (normalized || "plaintext")
    },
    content: text ? [{ type: "text", text }] : []
  }
}

export function warn(
  warnings: ImportWarning[],
  kind: string,
  from: string,
  to: string
): void {
  const existing = warnings.find((warning) => warning.kind === kind)
  if (existing) existing.count += 1
  else warnings.push({ kind, from, to, count: 1 })
}

export function finish(
  title: string,
  content: PMNode[],
  warnings: ImportWarning[],
  assetUrls: string[]
): ImportedDoc {
  const doc = content.length ? { type: "doc" as const, content } : emptyDoc()
  assertValidDoc(doc)
  return { title, doc, warnings, assetUrls: [...new Set(assetUrls)] }
}
