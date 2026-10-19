import {
  finish,
  imageNode,
  inlineBlocks,
  paragraph,
  textNodes,
  warn
} from "./rich-text"
import type {
  ConvertOptions,
  ImportedDoc,
  ImportWarning,
  PMMark,
  PMNode
} from "./types"

export interface GoogleTextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  link?: { url?: string }
}

export interface GoogleParagraphElement {
  textRun?: { content?: string; textStyle?: GoogleTextStyle }
  inlineObjectElement?: { inlineObjectId?: string }
  horizontalRule?: Record<string, unknown>
  [key: string]: unknown
}

export interface GoogleParagraph {
  paragraphStyle?: { namedStyleType?: string }
  elements?: GoogleParagraphElement[]
  bullet?: { listId?: string; nestingLevel?: number }
}

export interface GoogleStructuralElement {
  paragraph?: GoogleParagraph
  table?: {
    tableRows?: { tableCells?: { content?: GoogleStructuralElement[] }[] }[]
  }
  sectionBreak?: Record<string, unknown>
  tableOfContents?: { content?: GoogleStructuralElement[] }
  [key: string]: unknown
}

export interface GoogleDocumentContent {
  body?: { content?: GoogleStructuralElement[] }
  lists?: Record<
    string,
    {
      listProperties?: {
        nestingLevels?: {
          glyphType?: string
          glyphSymbol?: string
          startNumber?: number
        }[]
      }
    }
  >
  inlineObjects?: Record<
    string,
    {
      inlineObjectProperties?: {
        embeddedObject?: {
          title?: string
          description?: string
          imageProperties?: { contentUri?: string }
        }
      }
    }
  >
}

export interface GoogleTab {
  tabProperties?: { title?: string }
  documentTab?: GoogleDocumentContent
  childTabs?: GoogleTab[]
}

export interface GoogleDocument extends GoogleDocumentContent {
  title?: string
  tabs?: GoogleTab[]
  [key: string]: unknown
}

const ORDERED_GLYPH = /DECIMAL|ALPHA|ROMAN|^UPPER_/u
const HEADING_STYLE = /^HEADING_([1-6])$/u

function headingLevel(style?: string): number | undefined {
  if (style === "TITLE") return 1
  if (style === "SUBTITLE") return 2
  const match = style?.match(HEADING_STYLE)
  return match ? Math.min(Number(match[1]), 3) : undefined
}

function textMarks(style: GoogleTextStyle = {}): PMMark[] {
  const marks: PMMark[] = []
  for (const [key, type] of [
    ["bold", "bold"],
    ["italic", "italic"],
    ["underline", "underline"],
    ["strikethrough", "strike"]
  ] as const) {
    if (style[key]) marks.push({ type })
  }
  if (style.link?.url)
    marks.push({ type: "link", attrs: { href: style.link.url } })
  return marks
}

function cellParagraphs(nodes: PMNode[]): PMNode[] {
  return nodes.flatMap((node): PMNode[] => {
    if (["paragraph", "heading", "codeBlock"].includes(node.type))
      return [paragraph(node.content)]
    if (node.type === "image" || node.type === "horizontalRule") return [node]
    return cellParagraphs(node.content ?? [])
  })
}

function convertTab(
  title: string,
  source: GoogleDocumentContent,
  options: ConvertOptions
): ImportedDoc {
  const warnings: ImportWarning[] = []
  const assetUrls: string[] = []

  const paragraphContent = (value: GoogleParagraph): PMNode[] => {
    const content: PMNode[] = []
    const elements = value.elements ?? []
    for (const [index, element] of elements.entries()) {
      if (element.textRun) {
        let text = element.textRun.content ?? ""
        if (index === elements.length - 1 && text.endsWith("\n"))
          text = text.slice(0, -1)
        content.push(
          ...textNodes(
            text.replaceAll("\u000b", "\n"),
            textMarks(element.textRun.textStyle)
          )
        )
      } else if (element.inlineObjectElement) {
        const id = element.inlineObjectElement.inlineObjectId
        const object = id
          ? source.inlineObjects?.[id]?.inlineObjectProperties?.embeddedObject
          : undefined
        const src = object?.imageProperties?.contentUri
        if (src) {
          assetUrls.push(src)
          content.push(
            imageNode(
              src,
              options,
              object?.description ?? object?.title ?? "",
              object?.title
            )
          )
        }
      } else if (element.horizontalRule) {
        content.push({ type: "horizontalRule" })
      }
    }
    return content
  }

  const convert = (
    elements: GoogleStructuralElement[],
    skipLeadingEmpty = false
  ): PMNode[] => {
    const content: PMNode[] = []
    const stack: { level: number; listId: string; node: PMNode }[] = []
    for (const [index, element] of elements.entries()) {
      const value = element.paragraph
      if (value) {
        if (
          skipLeadingEmpty &&
          index === 0 &&
          !value.bullet &&
          value.elements?.every((part) => Boolean(part.textRun)) &&
          value.elements.map((part) => part.textRun?.content ?? "").join("") ===
            "\n"
        )
          continue
        const inline = paragraphContent(value)
        if (value.bullet) {
          const listId = value.bullet.listId ?? ""
          const level = Math.max(0, Math.trunc(value.bullet.nestingLevel ?? 0))
          const nesting =
            source.lists?.[listId]?.listProperties?.nestingLevels?.[level]
          const ordered =
            !nesting?.glyphSymbol &&
            ORDERED_GLYPH.test(nesting?.glyphType ?? "")
          const type = ordered ? "orderedList" : "bulletList"
          if (stack.at(-1)?.listId !== listId) stack.length = 0
          let frame = stack.at(-1)
          while (
            frame &&
            (frame.level > level ||
              (frame.level === level && frame.node.type !== type))
          ) {
            stack.pop()
            frame = stack.at(-1)
          }
          if (!frame || frame.level !== level) {
            const node: PMNode = {
              type,
              ...(ordered
                ? { attrs: { start: nesting?.startNumber ?? 1 } }
                : {}),
              content: []
            }
            const parent = frame?.node.content?.at(-1)
            if (parent) parent.content?.push(node)
            else content.push(node)
            frame = { level, listId, node }
            stack.push(frame)
          }
          const blocks = inlineBlocks(inline)
          if (blocks[0]?.type !== "paragraph") blocks.unshift(paragraph())
          frame.node.content?.push({ type: "listItem", content: blocks })
        } else {
          stack.length = 0
          const level = headingLevel(value.paragraphStyle?.namedStyleType)
          content.push(
            ...inlineBlocks(
              inline,
              level ? "heading" : "paragraph",
              level ? { level, collapsed: false } : undefined
            )
          )
        }
        continue
      }
      stack.length = 0
      if (element.table) {
        const rows = element.table.tableRows ?? []
        if (rows.length)
          content.push({
            type: "table",
            content: rows.map((row) => ({
              type: "tableRow",
              content: (row.tableCells ?? []).map((cell) => {
                const blocks = cellParagraphs(convert(cell.content ?? []))
                return {
                  type: "tableCell",
                  content: blocks.length ? blocks : [paragraph()]
                }
              })
            }))
          })
      } else if (element.tableOfContents) {
        warn(warnings, "table_of_contents", "Table of contents", "Omitted")
      }
    }
    return content
  }

  return finish(
    title,
    convert(source.body?.content ?? [], true),
    warnings,
    assetUrls
  )
}

export function googleDocToDocs(
  document: GoogleDocument,
  options: ConvertOptions = {}
): ImportedDoc[] {
  if (!document.tabs?.length)
    return [convertTab(document.title ?? "Untitled", document, options)]
  const result: ImportedDoc[] = []
  const visit = (tabs: GoogleTab[]): void => {
    for (const tab of tabs) {
      result.push(
        convertTab(
          tab.tabProperties?.title ?? document.title ?? "Untitled",
          tab.documentTab ?? {},
          options
        )
      )
      visit(tab.childTabs ?? [])
    }
  }
  visit(document.tabs)
  return result
}
