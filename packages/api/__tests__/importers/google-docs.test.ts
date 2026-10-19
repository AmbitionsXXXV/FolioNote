import { describe, expect, it } from "vite-plus/test"

import { googleDocToDocs } from "../../src/importers/google-docs"
import type {
  GoogleDocument,
  GoogleStructuralElement
} from "../../src/importers/google-docs"
import { assertValidDoc, emptyDoc } from "../../src/importers/validate"

const p = (
  content: string,
  style = "NORMAL_TEXT"
): GoogleStructuralElement => ({
  paragraph: {
    paragraphStyle: { namedStyleType: style },
    elements: [{ textRun: { content } }]
  }
})
const bullet = (
  content: string,
  nestingLevel: number,
  listId = "lesson"
): GoogleStructuralElement => ({
  paragraph: {
    bullet: { listId, nestingLevel },
    elements: [{ textRun: { content: `${content}\n` } }]
  }
})

describe("Google Docs import", () => {
  it("imports two tabs with Japanese text, mixed nested lists, tables and images", () => {
    const document: GoogleDocument = {
      title: "日本語",
      tabs: [
        {
          tabProperties: { title: "活用" },
          documentTab: {
            lists: {
              lesson: {
                listProperties: {
                  nestingLevels: [
                    { glyphSymbol: "●" },
                    { glyphType: "DECIMAL", startNumber: 3 }
                  ]
                }
              }
            },
            inlineObjects: {
              photo: {
                inlineObjectProperties: {
                  embeddedObject: {
                    title: "活用表",
                    description: "動詞の表",
                    imageProperties: {
                      contentUri: "https://example.com/expiring.png"
                    }
                  }
                }
              }
            },
            body: {
              content: [
                p("\n"),
                p("動詞\n", "HEADING_1"),
                bullet("迷う", 0),
                bullet("迷わない", 1),
                bullet("迷います", 1),
                bullet("来る", 0),
                {
                  table: {
                    tableRows: [
                      {
                        tableCells: [
                          { content: [p("辞書形\n")] },
                          { content: [p("否定形\n")] }
                        ]
                      },
                      {
                        tableCells: [
                          { content: [p("迷う\n")] },
                          { content: [p("迷わない\n")] }
                        ]
                      }
                    ]
                  }
                },
                {
                  paragraph: {
                    elements: [
                      { textRun: { content: "前" } },
                      { inlineObjectElement: { inlineObjectId: "photo" } },
                      { textRun: { content: "後\n" } }
                    ]
                  }
                }
              ]
            }
          }
        },
        {
          tabProperties: { title: "練習" },
          documentTab: { body: { content: [p("明日来る。\n")] } }
        }
      ]
    }
    const original = JSON.stringify(document)
    const result = googleDocToDocs(document, {
      mapImageUrl: () => "https://cdn.example.com/stored.png"
    })
    for (const imported of result)
      expect(() => assertValidDoc(imported.doc)).not.toThrow()
    expect(JSON.stringify(document)).toBe(original)
    expect(result.map((doc) => doc.title)).toEqual(["活用", "練習"])
    const content = result[0].doc.content
    expect(content.map((node) => node.type)).toEqual([
      "heading",
      "bulletList",
      "table",
      "paragraph",
      "image",
      "paragraph"
    ])
    expect(content[0]).toMatchObject({
      attrs: { level: 1 },
      content: [{ text: "動詞" }]
    })
    expect(content[1].content).toHaveLength(2)
    expect(content[1].content?.[0].content?.[1]).toMatchObject({
      type: "orderedList",
      attrs: { start: 3 },
      content: [{ type: "listItem" }, { type: "listItem" }]
    })
    expect(content[2].content?.[1].content?.[1]).toMatchObject({
      type: "tableCell",
      content: [{ type: "paragraph", content: [{ text: "迷わない" }] }]
    })
    expect(content[4].attrs).toMatchObject({
      src: "https://cdn.example.com/stored.png",
      alt: "動詞の表"
    })
    expect(result[0].assetUrls).toEqual(["https://example.com/expiring.png"])
    expect(result[1].assetUrls).toEqual([])
    expect(result[1].warnings).toEqual([])
  })

  it("flattens child tabs in order and keeps per-tab object scopes", () => {
    const result = googleDocToDocs({
      title: "Fallback",
      tabs: [
        {
          tabProperties: { title: "親" },
          childTabs: [
            {
              tabProperties: { title: "子" },
              childTabs: [{ tabProperties: { title: "孫" } }]
            }
          ]
        },
        { tabProperties: { title: "次" } }
      ]
    })
    for (const imported of result)
      expect(() => assertValidDoc(imported.doc)).not.toThrow()
    expect(result.map((doc) => doc.title)).toEqual(["親", "子", "孫", "次"])
    expect(
      result.every(
        (doc) => JSON.stringify(doc.doc) === JSON.stringify(emptyDoc())
      )
    ).toBe(true)
  })

  it("handles legacy bodies, heading levels, text marks, breaks and TOC omission", () => {
    const styles = [
      "TITLE",
      "SUBTITLE",
      "HEADING_1",
      "HEADING_2",
      "HEADING_3",
      "HEADING_4",
      "HEADING_5",
      "HEADING_6"
    ]
    const [result] = googleDocToDocs({
      title: "Legacy",
      suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
      body: {
        content: [
          ...styles.map((style) => p(`${style}\n`, style)),
          {
            paragraph: {
              elements: [
                {
                  textRun: {
                    content: "来る\u000b帰る\n",
                    textStyle: {
                      bold: true,
                      italic: true,
                      underline: true,
                      strikethrough: true,
                      link: { url: "https://example.com" }
                    }
                  }
                }
              ]
            }
          },
          {
            paragraph: {
              elements: [{ horizontalRule: {} }, { textRun: { content: "\n" } }]
            }
          },
          { sectionBreak: {} },
          { tableOfContents: {} },
          p("\n")
        ]
      }
    })
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.title).toBe("Legacy")
    expect(
      result.doc.content.slice(0, 8).map((node) => node.attrs?.level)
    ).toEqual([1, 2, 1, 2, 3, 3, 3, 3])
    expect(result.doc.content[8].content?.map((node) => node.type)).toEqual([
      "text",
      "hardBreak",
      "text"
    ])
    expect(
      result.doc.content[8].content?.[0].marks?.map((mark) => mark.type)
    ).toEqual(
      expect.arrayContaining(["bold", "italic", "underline", "strike", "link"])
    )
    expect(result.doc.content[9].type).toBe("horizontalRule")
    expect(result.doc.content[10]).toEqual({ type: "paragraph", content: [] })
    expect(result.warnings).toEqual([
      {
        kind: "table_of_contents",
        from: "Table of contents",
        to: "Omitted",
        count: 1
      }
    ])
  })

  it("separates list IDs, resumes after nesting, and flattens cell headings and lists", () => {
    const [result] = googleDocToDocs({
      lists: {
        lesson: {
          listProperties: {
            nestingLevels: [
              { glyphType: "UPPER_ROMAN" },
              { glyphType: "GLYPH_TYPE_UNSPECIFIED" }
            ]
          }
        },
        other: { listProperties: { nestingLevels: [{ glyphType: "ALPHA" }] } }
      },
      body: {
        content: [
          bullet("一", 0),
          bullet("枝", 1),
          bullet("二", 0),
          bullet("別", 0, "other"),
          p("区切り\n"),
          bullet("再開", 0),
          {
            table: {
              tableRows: [
                {
                  tableCells: [
                    {
                      content: [p("見出し\n", "HEADING_2"), bullet("項目", 0)]
                    },
                    { content: [] }
                  ]
                }
              ]
            }
          }
        ]
      }
    })
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.doc.content.map((node) => node.type)).toEqual([
      "orderedList",
      "orderedList",
      "paragraph",
      "orderedList",
      "table"
    ])
    expect(result.doc.content[0].content).toHaveLength(2)
    expect(result.doc.content[0].content?.[0].content?.[1].type).toBe(
      "bulletList"
    )
    expect(
      result.doc.content[4].content?.[0].content?.[0].content?.map(
        (node) => node.type
      )
    ).toEqual(["paragraph", "paragraph"])
    expect(result.doc.content[4].content?.[0].content?.[1].content).toEqual([
      { type: "paragraph", content: [] }
    ])
  })

  it("returns a valid empty document for missing legacy content", () => {
    const [result] = googleDocToDocs({})
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.doc).toEqual(emptyDoc())
    expect(result.title).toBe("Untitled")
  })
})
