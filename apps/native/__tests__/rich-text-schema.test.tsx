import { getSchema } from "@tiptap/core"
import type { JSONContent } from "@tiptap/core"
import { describe, expect, it } from "vite-plus/test"

import { RICH_TEXT_SCHEMA_EXTENSIONS } from "../components/rich-text/editor-schema"

const cell = (
  type: "tableCell" | "tableHeader",
  text: string,
  attrs: Record<string, unknown> = {}
): JSONContent => ({
  type,
  attrs,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }]
})

/** Everything the web editor can save that the native editor must not drop. */
const webDoc: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, collapsed: true, sourceBlockId: "h1" },
      content: [{ type: "text", text: "動詞" }]
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            cell("tableHeader", "辞書形", { colwidth: [180] }),
            cell("tableHeader", "て形")
          ]
        },
        {
          type: "tableRow",
          content: [
            cell("tableCell", "行く", { backgroundColor: "#fde68a" }),
            cell("tableCell", "行って", { textAlign: "center" })
          ]
        }
      ]
    },
    {
      type: "image",
      attrs: { src: "https://example.com/a.png", alt: "verb chart", width: 320 }
    },
    {
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [{ type: "text", text: 'const te = "って"' }]
    },
    {
      type: "japaneseSentence",
      attrs: { text: "満員電車に揺られていた人", translation: "被摇晃的人" }
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "NHK",
          marks: [{ type: "link", attrs: { href: "https://www3.nhk.or.jp" } }]
        }
      ]
    }
  ]
}

describe("native rich-text editor schema", () => {
  const schema = getSchema(RICH_TEXT_SCHEMA_EXTENSIONS)
  const roundTrip = schema.nodeFromJSON(webDoc).toJSON() as JSONContent

  it("parses every web block without stripping it", () => {
    expect(roundTrip.content?.map((node) => node.type)).toEqual([
      "heading",
      "table",
      "image",
      "codeBlock",
      "japaneseSentence",
      "paragraph"
    ])
  })

  it("keeps the attributes the web editor saved", () => {
    const [heading, table, image, code, sentence] = roundTrip.content ?? []
    expect(heading?.attrs).toMatchObject({
      level: 2,
      collapsed: true,
      sourceBlockId: "h1"
    })
    const [headerRow, bodyRow] = table?.content ?? []
    expect(headerRow?.content?.[0]?.attrs).toMatchObject({ colwidth: [180] })
    expect(bodyRow?.content?.[0]?.attrs).toMatchObject({
      backgroundColor: "#fde68a"
    })
    expect(bodyRow?.content?.[1]?.attrs).toMatchObject({ textAlign: "center" })
    expect(image?.attrs).toMatchObject({
      src: "https://example.com/a.png",
      width: 320
    })
    expect(code?.attrs).toMatchObject({ language: "typescript" })
    expect(sentence?.attrs).toMatchObject({ translation: "被摇晃的人" })
  })

  it("registers exactly one link extension (the hardened CustomLink)", () => {
    const links = RICH_TEXT_SCHEMA_EXTENSIONS.filter(
      (extension) => extension.name === "link"
    )
    expect(links).toHaveLength(1)
  })
})
