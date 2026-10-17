import { describe, expect, it } from "vite-plus/test"

import { notionBlocksToDoc, notionPageTitle } from "../../src/importers/notion"
import type { NotionBlock, NotionRichText } from "../../src/importers/notion"
import {
  assertValidDoc,
  emptyDoc,
  getImportSchema
} from "../../src/importers/validate"

const text = (content: string): NotionRichText[] => [
  { type: "text", text: { content }, plain_text: content }
]

describe("Notion import", () => {
  it("builds the actual collaboration schema and validates documents", () => {
    const schema = getImportSchema()
    expect(getImportSchema()).toBe(schema)
    expect(schema.nodes.image.isInline).toBe(false)
    expect(Object.keys(schema.marks)).toEqual(
      expect.arrayContaining([
        "bold",
        "italic",
        "strike",
        "code",
        "underline",
        "link"
      ])
    )
    expect(schema.nodes.heading.defaultAttrs).toMatchObject({
      level: 1,
      collapsed: false
    })
    expect(schema.nodes.tableCell.defaultAttrs).toMatchObject({
      colspan: 1,
      rowspan: 1,
      colwidth: null,
      backgroundColor: null,
      textAlign: "left"
    })
    expect(() => assertValidDoc(emptyDoc())).not.toThrow()
    expect(() =>
      assertValidDoc({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "image", attrs: { src: "https://example.com/a.png" } }
            ]
          }
        ]
      })
    ).toThrow("Invalid imported document")
    expect(() =>
      assertValidDoc({ type: "doc", content: [{ type: "text", text: "" }] })
    ).toThrow("Invalid imported document")
  })

  it("imports a Japanese lesson with nested lists, a table, callout and image", () => {
    const blocks: NotionBlock[] = [
      { type: "heading_2", heading_2: { rich_text: text("動詞の活用") } },
      {
        type: "callout",
        callout: {
          icon: { type: "emoji", emoji: "💡" },
          rich_text: text("「来る」は不規則動詞です。")
        }
      },
      {
        type: "numbered_list_item",
        numbered_list_item: { rich_text: text("迷う") },
        children: [
          {
            type: "numbered_list_item",
            numbered_list_item: { rich_text: text("迷わない") }
          },
          {
            type: "numbered_list_item",
            numbered_list_item: { rich_text: text("迷います") }
          }
        ]
      },
      {
        type: "numbered_list_item",
        numbered_list_item: { rich_text: text("来る") }
      },
      {
        type: "table",
        table: { table_width: 2, has_column_header: true },
        children: [
          {
            type: "table_row",
            table_row: { cells: [text("辞書形"), text("否定形")] }
          },
          {
            type: "table_row",
            table_row: { cells: [text("迷う"), text("迷わない")] }
          }
        ]
      },
      {
        id: "abc-def",
        type: "child_database",
        child_database: { title: "単語帳" }
      },
      {
        type: "image",
        image: {
          type: "file",
          file: { url: "https://example.com/expired.png" },
          caption: text("活用表")
        }
      }
    ]
    const original = JSON.stringify(blocks)
    const result = notionBlocksToDoc(
      { title: "日本語", blocks },
      { mapImageUrl: () => "https://cdn.example.com/table.png" }
    )
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(JSON.stringify(blocks)).toBe(original)
    expect(result.doc.content.map((node) => node.type)).toEqual([
      "heading",
      "blockquote",
      "orderedList",
      "table",
      "paragraph",
      "image"
    ])
    expect(
      result.doc.content[1].content?.[0].content
        ?.map((node) => node.text)
        .join("")
    ).toBe("💡 「来る」は不規則動詞です。")
    expect(result.doc.content[2].content).toHaveLength(2)
    expect(result.doc.content[2].content?.[0].content?.[1]).toMatchObject({
      type: "orderedList",
      content: [{ type: "listItem" }, { type: "listItem" }]
    })
    expect(result.doc.content[3].content?.[0].content?.[0]).toMatchObject({
      type: "tableHeader",
      content: [{ type: "paragraph", content: [{ text: "辞書形" }] }]
    })
    expect(result.doc.content[3].content?.[1].content?.[1]).toMatchObject({
      type: "tableCell",
      content: [{ type: "paragraph", content: [{ text: "迷わない" }] }]
    })
    expect(result.doc.content[4].content?.[0]).toMatchObject({
      text: "↗ 単語帳",
      marks: [{ type: "link", attrs: { href: "https://www.notion.so/abcdef" } }]
    })
    expect(result.doc.content[5].attrs).toMatchObject({
      src: "https://cdn.example.com/table.png",
      alt: "活用表"
    })
    expect(result.assetUrls).toEqual(["https://example.com/expired.png"])
    expect(result.warnings).toEqual([
      {
        kind: "database",
        from: "Database view",
        to: "Link to source",
        count: 1
      }
    ])
  })

  it("preserves annotations, mentions, equations and hard breaks without empty text", () => {
    const result = notionBlocksToDoc({
      title: "",
      blocks: [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "太字\n下線",
                  link: { url: "https://example.com" }
                },
                annotations: {
                  bold: true,
                  italic: true,
                  strikethrough: true,
                  underline: true
                }
              },
              {
                type: "mention",
                plain_text: "田中さん",
                mention: { type: "user" }
              },
              { type: "equation", equation: { expression: "x^2" } },
              {
                type: "text",
                text: { content: "code" },
                href: "https://example.com/code",
                annotations: { code: true, bold: true }
              },
              { type: "text", text: { content: "" } }
            ]
          }
        }
      ]
    })
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    const content = result.doc.content[0].content ?? []
    expect(content.map((node) => node.type)).toEqual([
      "text",
      "hardBreak",
      "text",
      "text",
      "text",
      "text"
    ])
    expect(content[0].marks?.map((mark) => mark.type)).toEqual(
      expect.arrayContaining(["bold", "italic", "strike", "underline", "link"])
    )
    expect(content[3].text).toBe("田中さん")
    expect(content[4]).toMatchObject({ text: "x^2", marks: [{ type: "code" }] })
  })

  it("aggregates fallbacks and keeps list boundaries and child ordering", () => {
    const result = notionBlocksToDoc({
      title: "構造",
      blocks: [
        { type: "to_do", to_do: { checked: false, rich_text: text("読む") } },
        { type: "to_do", to_do: { checked: true, rich_text: text("書く") } },
        {
          type: "paragraph",
          paragraph: { rich_text: text("間") },
          children: [{ type: "divider" }]
        },
        {
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: text("箇条書き") }
        },
        {
          type: "toggle",
          toggle: { rich_text: text("答え") },
          children: [
            { type: "paragraph", paragraph: { rich_text: text("来る") } }
          ]
        },
        { type: "quote", quote: { rich_text: text("引用") } },
        { type: "heading_4", heading_4: { rich_text: text("見出し") } },
        {
          type: "code",
          code: { language: "Plain Text", rich_text: text("a\nb") }
        },
        { type: "equation", equation: { expression: "a^2" } },
        {
          id: "child-id",
          type: "child_page",
          child_page: { title: "子ページ" }
        },
        { type: "link_to_page", link_to_page: { page_id: "target-id" } },
        ...[
          "bookmark",
          "embed",
          "link_preview",
          "video",
          "pdf",
          "file",
          "audio"
        ].map((type) => ({
          type,
          [type]: { external: { url: "https://example.com/source" } }
        })),
        {
          type: "synced_block",
          children: [
            { type: "paragraph", paragraph: { rich_text: text("同期") } }
          ]
        },
        {
          type: "column_list",
          children: [
            {
              type: "column",
              children: [
                { type: "paragraph", paragraph: { rich_text: text("列") } }
              ]
            }
          ]
        },
        { type: "table_of_contents" },
        { type: "breadcrumb" },
        { type: "unsupported" },
        { type: "future_block" }
      ]
    })
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.doc.content.slice(0, 6).map((node) => node.type)).toEqual([
      "bulletList",
      "paragraph",
      "horizontalRule",
      "bulletList",
      "paragraph",
      "paragraph"
    ])
    expect(
      result.doc.content[0].content?.map(
        (item) => item.content?.[0].content?.[0].text
      )
    ).toEqual(["☐ ", "☑ "])
    expect(result.doc.content[4].content?.[0].marks).toEqual([{ type: "bold" }])
    expect(result.doc.content[7].attrs?.level).toBe(3)
    expect(result.doc.content[8]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "plaintext" },
      content: [{ text: "a\nb" }]
    })
    expect(result.doc.content[9].attrs?.language).toBe("latex")
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        { kind: "to_do", from: "Checklist", to: "Checklist as list", count: 2 },
        { kind: "embed", from: "Embeds & files", to: "Link", count: 7 },
        {
          kind: "unsupported",
          from: "Unsupported blocks",
          to: "Omitted",
          count: 2
        }
      ])
    )
    expect(result.doc.content.at(-1)?.content?.[0].text).toBe("列")
  })

  it("handles empty documents, external images and arbitrary title property names", () => {
    const result = notionBlocksToDoc({ title: "Empty", blocks: [] })
    const image = notionBlocksToDoc({
      title: "Image",
      blocks: [
        {
          type: "image",
          image: { external: { url: "https://example.com/public.png" } }
        }
      ]
    })
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(() => assertValidDoc(image.doc)).not.toThrow()
    expect(result.doc).toEqual(emptyDoc())
    expect(image.assetUrls).toEqual([])
    expect(image.doc.content[0].attrs?.src).toBe(
      "https://example.com/public.png"
    )
    expect(
      notionPageTitle({
        properties: {
          名前: { type: "title", title: text("日本語ノート") },
          title: { type: "number" }
        }
      })
    ).toBe("日本語ノート")
    expect(notionPageTitle({ properties: {} })).toBe("Untitled")
  })

  it("tags top-level nodes with their source block for pull sync", () => {
    const { doc, sources } = notionBlocksToDoc({
      title: "Sync",
      blocks: [
        { id: "h1", type: "heading_2", heading_2: { rich_text: text("動詞") } },
        {
          id: "l1",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: text("迷う") }
        },
        {
          id: "l2",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: text("稼ぐ") }
        },
        {
          id: "t1",
          type: "toggle",
          toggle: { rich_text: text("答え") },
          children: [
            {
              id: "p1",
              type: "paragraph",
              paragraph: { rich_text: text("迷わない") }
            }
          ]
        }
      ]
    })
    assertValidDoc(doc)
    expect(doc.content.map((node) => node.attrs?.sourceBlockId)).toEqual([
      "h1",
      "l1",
      "t1",
      "t1#1"
    ])
    // the grouped list covers both items, so either one changing is a change
    expect(sources).toEqual({
      h1: ["h1"],
      l1: ["l1", "l2"],
      t1: ["t1"],
      "t1#1": ["t1"]
    })
  })
})
