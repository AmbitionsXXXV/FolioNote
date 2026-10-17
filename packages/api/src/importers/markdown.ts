import { Lexer } from "marked"
import type { MarkedToken, Token, Tokens } from "marked"

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

const CODE_LANGUAGE = /\s+/u
const INLINE_MARKS = { strong: "bold", em: "italic", del: "strike" } as const

export function markdownToDoc(
  markdown: string,
  options: ConvertOptions & { titleFallback?: string } = {}
): ImportedDoc {
  const warnings: ImportWarning[] = []
  const lexer = new Lexer({ gfm: true, breaks: false, pedantic: false })
  const tokens = lexer
    .lex(markdown)
    .filter((token) => token.type !== "space") as MarkedToken[]
  const first = tokens[0]
  const title =
    first?.type === "heading" && first.depth === 1
      ? first.text
      : (options.titleFallback ?? "Untitled")
  const body =
    first?.type === "heading" && first.depth === 1 ? tokens.slice(1) : tokens
  const htmlWarning = (): void => warn(warnings, "html", "HTML", "Plain text")

  const inline = (tokens: Token[], marks: PMMark[] = []): PMNode[] => {
    const content: PMNode[] = []
    // This lexer has no custom token extensions, so only built-in tokens occur.
    for (const token of tokens as MarkedToken[]) {
      switch (token.type) {
        case "strong":
        case "em":
        case "del":
          content.push(
            ...inline(token.tokens, [
              ...marks,
              { type: INLINE_MARKS[token.type] }
            ])
          )
          break
        case "codespan":
          content.push(...textNodes(token.text, [...marks, { type: "code" }]))
          break
        case "br":
          content.push({ type: "hardBreak" })
          break
        case "link":
          content.push(
            ...inline(token.tokens, [
              ...marks,
              { type: "link", attrs: { href: token.href } }
            ])
          )
          break
        case "image":
          content.push(imageNode(token.href, options, token.text, token.title))
          break
        case "html":
          htmlWarning()
          content.push(...textNodes(token.text, marks))
          break
        case "text":
          content.push(
            ...(token.tokens
              ? inline(token.tokens, marks)
              : textNodes(token.text, marks))
          )
          break
        case "escape":
          content.push(...textNodes(token.text, marks))
          break
        default:
          break
      }
    }
    return content
  }

  const listItem = (item: Tokens.ListItem): PMNode => {
    const content = blocks(item.tokens)
    let firstParagraph = content[0]
    if (firstParagraph?.type !== "paragraph") {
      firstParagraph = paragraph()
      content.unshift(firstParagraph)
    }
    if (item.task) {
      warn(warnings, "to_do", "Checklist", "Checklist as list")
      firstParagraph.content = [
        ...textNodes(item.checked ? "☑ " : "☐ "),
        ...(firstParagraph.content ?? [])
      ]
    }
    return { type: "listItem", content }
  }

  const blocks = (tokens: Token[]): PMNode[] => {
    const content: PMNode[] = []
    for (const token of tokens as MarkedToken[]) {
      switch (token.type) {
        case "heading":
          content.push(
            ...inlineBlocks(inline(token.tokens), "heading", {
              level: Math.min(token.depth, 3),
              collapsed: false
            })
          )
          break
        case "paragraph":
        case "text":
          content.push(
            ...inlineBlocks(
              token.tokens ? inline(token.tokens) : textNodes(token.text)
            )
          )
          break
        case "list":
          if (token.items.length)
            content.push({
              type: token.ordered ? "orderedList" : "bulletList",
              ...(token.ordered ? { attrs: { start: token.start || 1 } } : {}),
              content: token.items.map(listItem)
            })
          break
        case "blockquote": {
          const children = blocks(token.tokens)
          content.push({
            type: "blockquote",
            content: children.length ? children : [paragraph()]
          })
          break
        }
        case "code":
          content.push(
            codeBlock(
              token.text,
              token.lang?.split(CODE_LANGUAGE)[0] || "plaintext"
            )
          )
          break
        case "hr":
          content.push({ type: "horizontalRule" })
          break
        case "table":
          content.push({
            type: "table",
            content: [token.header, ...token.rows].map((row, index) => ({
              type: "tableRow",
              content: row.map((cell, column) => ({
                type: index === 0 ? "tableHeader" : "tableCell",
                attrs: { textAlign: token.align[column] ?? "left" },
                content: inlineBlocks(inline(cell.tokens))
              }))
            }))
          })
          break
        case "html":
          htmlWarning()
          content.push(paragraph(textNodes(token.text)))
          break
        case "space":
        case "def":
        case "checkbox":
          break
        default:
          content.push(...inlineBlocks(inline([token])))
      }
    }
    return content
  }

  return finish(title, blocks(body), warnings, [])
}
