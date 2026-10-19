import {
  codeBlock,
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

export interface NotionRichText {
  type?: string
  plain_text?: string
  href?: string | null
  text?: { content: string; link?: { url: string } | null }
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
    color?: string
  }
  equation?: { expression: string }
  mention?: unknown
}

export interface NotionBlockContent {
  rich_text?: NotionRichText[]
  caption?: NotionRichText[]
  checked?: boolean
  language?: string
  title?: string
  url?: string
  type?: string
  external?: { url: string }
  file?: { url: string; expiry_time?: string }
  icon?: { type?: string; emoji?: string }
  expression?: string
  has_column_header?: boolean
  has_row_header?: boolean
  table_width?: number
  cells?: NotionRichText[][]
  page_id?: string
  database_id?: string
  block_id?: string
  [key: string]: unknown
}

export interface NotionBlock {
  id?: string
  type: string
  children?: NotionBlock[]
  paragraph?: NotionBlockContent
  heading_1?: NotionBlockContent
  heading_2?: NotionBlockContent
  heading_3?: NotionBlockContent
  heading_4?: NotionBlockContent
  bulleted_list_item?: NotionBlockContent
  numbered_list_item?: NotionBlockContent
  to_do?: NotionBlockContent
  toggle?: NotionBlockContent
  quote?: NotionBlockContent
  callout?: NotionBlockContent
  code?: NotionBlockContent
  table?: NotionBlockContent
  table_row?: NotionBlockContent
  image?: NotionBlockContent
  bookmark?: NotionBlockContent
  embed?: NotionBlockContent
  link_preview?: NotionBlockContent
  video?: NotionBlockContent
  pdf?: NotionBlockContent
  file?: NotionBlockContent
  audio?: NotionBlockContent
  equation?: NotionBlockContent
  child_page?: NotionBlockContent
  child_database?: NotionBlockContent
  link_to_page?: NotionBlockContent
  [key: string]: unknown
}

export interface NotionPage {
  properties?: Record<
    string,
    { type: string; title?: NotionRichText[]; [key: string]: unknown }
  >
  [key: string]: unknown
}

function plainText(parts: NotionRichText[] = []): string {
  return parts
    .map(
      (part) =>
        part.plain_text ?? part.text?.content ?? part.equation?.expression ?? ""
    )
    .join("")
}

export function notionPageTitle(page: NotionPage): string {
  const title = Object.values(page.properties ?? {}).find(
    (property) => property.type === "title"
  )
  return plainText(title?.title) || "Untitled"
}

function richText(
  parts: NotionRichText[] = [],
  extra: PMMark[] = []
): PMNode[] {
  return parts.flatMap((part) => {
    const marks = [...extra]
    const annotations = part.annotations
    for (const [key, type] of [
      ["bold", "bold"],
      ["italic", "italic"],
      ["strikethrough", "strike"],
      ["underline", "underline"],
      ["code", "code"]
    ] as const) {
      if (annotations?.[key]) marks.push({ type })
    }
    const href = part.href ?? part.text?.link?.url
    if (href) marks.push({ type: "link", attrs: { href } })
    if (part.type === "equation") marks.push({ type: "code" })
    return textNodes(plainText([part]), marks)
  })
}

function sourceLink(id: string | undefined): string | undefined {
  return id ? `https://www.notion.so/${id.replaceAll("-", "")}` : undefined
}

const LIST_BLOCK_TYPES = new Set([
  "bulleted_list_item",
  "numbered_list_item",
  "to_do"
])

/** Editor list node per Notion list block type (bullets are the default). */
const LIST_TYPES: Record<string, string> = {
  numbered_list_item: "orderedList",
  to_do: "taskList"
}

export function notionBlocksToDoc(
  input: { title: string; blocks: NotionBlock[] },
  options: ConvertOptions = {}
): ImportedDoc {
  const warnings: ImportWarning[] = []
  const assetUrls: string[] = []
  const link = (url: string | undefined, label = url ?? ""): PMNode =>
    paragraph(
      textNodes(label, url ? [{ type: "link", attrs: { href: url } }] : [])
    )

  const convert = (blocks: NotionBlock[]): PMNode[] => {
    const content: PMNode[] = []
    let previousListType: string | undefined
    for (const block of blocks) {
      const listType = LIST_TYPES[block.type] ?? "bulletList"
      if (
        ["bulleted_list_item", "numbered_list_item", "to_do"].includes(
          block.type
        )
      ) {
        const data =
          block.bulleted_list_item ?? block.numbered_list_item ?? block.to_do
        const item: PMNode = {
          type: block.type === "to_do" ? "taskItem" : "listItem",
          ...(block.type === "to_do"
            ? { attrs: { checked: data?.checked === true } }
            : {}),
          content: [
            paragraph(richText(data?.rich_text)),
            ...convert(block.children ?? [])
          ]
        }
        const previous = content.at(-1)
        if (previousListType === block.type && previous?.type === listType)
          previous.content?.push(item)
        else
          content.push({
            type: listType,
            ...(listType === "orderedList" ? { attrs: { start: 1 } } : {}),
            content: [item]
          })
        previousListType = block.type
        continue
      }
      previousListType = undefined
      switch (block.type) {
        case "paragraph":
          content.push(
            paragraph(richText(block.paragraph?.rich_text)),
            ...convert(block.children ?? [])
          )
          break
        case "heading_1":
        case "heading_2":
        case "heading_3":
        case "heading_4": {
          const data =
            block.heading_1 ??
            block.heading_2 ??
            block.heading_3 ??
            block.heading_4
          content.push(
            {
              type: "heading",
              attrs: {
                level: Math.min(Number(block.type.at(-1)), 3),
                collapsed: false
              },
              content: richText(data?.rich_text)
            },
            ...convert(block.children ?? [])
          )
          break
        }
        case "toggle":
          warn(warnings, "toggle", "Toggle", "Expanded text")
          content.push(
            paragraph(richText(block.toggle?.rich_text, [{ type: "bold" }])),
            ...convert(block.children ?? [])
          )
          break
        case "quote":
        case "callout": {
          const data = block.quote ?? block.callout
          const emoji = block.type === "callout" ? data?.icon?.emoji : undefined
          content.push({
            type: "blockquote",
            content: [
              paragraph([
                ...textNodes(emoji ? `${emoji} ` : ""),
                ...richText(data?.rich_text)
              ]),
              ...convert(block.children ?? [])
            ]
          })
          break
        }
        case "code": {
          const language = block.code?.language?.toLowerCase() ?? "plaintext"
          content.push(
            codeBlock(
              plainText(block.code?.rich_text),
              language === "plain text" ? "plaintext" : language
            )
          )
          break
        }
        case "equation":
          content.push(codeBlock(block.equation?.expression ?? "", "latex"))
          break
        case "divider":
          content.push({ type: "horizontalRule" })
          break
        case "table": {
          const rows = (block.children ?? []).filter(
            (row) => row.type === "table_row"
          )
          if (rows.length)
            content.push({
              type: "table",
              content: rows.map((row, index) => ({
                type: "tableRow",
                content: (row.table_row?.cells ?? []).map((cell) => ({
                  type:
                    index === 0 && block.table?.has_column_header
                      ? "tableHeader"
                      : "tableCell",
                  content: [paragraph(richText(cell))]
                }))
              }))
            })
          break
        }
        case "image": {
          const src = block.image?.external?.url ?? block.image?.file?.url
          if (src) {
            if (block.image?.file?.url) assetUrls.push(block.image.file.url)
            content.push(
              ...inlineBlocks([
                imageNode(src, options, plainText(block.image?.caption))
              ])
            )
          }
          break
        }
        case "bookmark":
        case "embed":
        case "link_preview":
        case "video":
        case "pdf":
        case "file":
        case "audio": {
          const data =
            block.bookmark ??
            block.embed ??
            block.link_preview ??
            block.video ??
            block.pdf ??
            block.file ??
            block.audio
          warn(warnings, "embed", "Embeds & files", "Link")
          content.push(
            link(data?.url ?? data?.external?.url ?? data?.file?.url)
          )
          break
        }
        case "child_page":
          warn(warnings, "child_page", "Sub-page", "Link (import separately)")
          content.push(
            link(
              sourceLink(block.id),
              `↗ ${block.child_page?.title ?? "Untitled"}`
            )
          )
          break
        case "child_database":
        case "link_to_page": {
          warn(warnings, "database", "Database view", "Link to source")
          const target = block.link_to_page
          content.push(
            link(
              sourceLink(
                target?.page_id ??
                  target?.database_id ??
                  target?.block_id ??
                  block.id
              ),
              `↗ ${block.child_database?.title ?? "Source"}`
            )
          )
          break
        }
        case "synced_block":
          warn(warnings, "synced_block", "Synced block", "Inlined copy")
          content.push(...convert(block.children ?? []))
          break
        case "column_list":
        case "column":
          warn(warnings, "columns", "Columns", "Stacked")
          content.push(...convert(block.children ?? []))
          break
        case "table_of_contents":
        case "breadcrumb":
          warn(
            warnings,
            block.type,
            block.type === "breadcrumb" ? "Breadcrumb" : "Table of contents",
            "Omitted"
          )
          break
        default:
          warn(warnings, "unsupported", "Unsupported blocks", "Omitted")
      }
    }
    return content
  }

  // Top level, one block at a time, so every produced node can be tagged
  // with the block it came from. Consecutive list items are re-merged
  // exactly as convert() groups them.
  const content: PMNode[] = []
  const sources: Record<string, string[]> = {}
  let previous: { type: string; key: string | null } | null = null
  for (const block of input.blocks) {
    const nodes = convert([block])
    const [first] = nodes
    const last = content.at(-1)
    const continuesList =
      LIST_BLOCK_TYPES.has(block.type) &&
      previous?.type === block.type &&
      first !== undefined &&
      last?.type === first.type
    if (continuesList && last && first) {
      last.content?.push(...(first.content ?? []))
      if (previous?.key && block.id) sources[previous.key]?.push(block.id)
      continue
    }
    let key: string | null = null
    for (const [index, node] of nodes.entries()) {
      if (!block.id) break
      const nodeKey = index === 0 ? block.id : `${block.id}#${index}`
      node.attrs = { ...node.attrs, sourceBlockId: nodeKey }
      sources[nodeKey] = [block.id]
      key = nodeKey
    }
    content.push(...nodes)
    previous = { type: block.type, key: nodes.length > 0 ? key : null }
  }
  return { ...finish(input.title, content, warnings, assetUrls), sources }
}
