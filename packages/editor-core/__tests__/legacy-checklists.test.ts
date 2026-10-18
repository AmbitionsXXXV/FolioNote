import { getSchema } from "@tiptap/core"
import { EditorState } from "@tiptap/pm/state"
import { describe, expect, it } from "vite-plus/test"

import { COLLAB_SCHEMA_EXTENSIONS } from "../src/collab/schema-extensions"
import { convertLegacyChecklists } from "../src/extensions/legacy-checklists"

const schema = getSchema(COLLAB_SCHEMA_EXTENSIONS)

const text = (value: string) => ({ type: "text", text: value })
const paragraph = (...content: object[]) => ({ type: "paragraph", content })
const item = (...content: object[]) => ({ type: "listItem", content })
const bullets = (...content: object[]) => ({ type: "bulletList", content })

function convert(...content: object[]) {
  const state = EditorState.create({
    doc: schema.nodeFromJSON({ type: "doc", content })
  })
  return convertLegacyChecklists(state)?.doc.toJSON().content
}

describe("convertLegacyChecklists", () => {
  it("turns an all-checkbox bullet list into a checklist and strips the glyphs", () => {
    const result = convert(paragraph(text("前")), {
      ...bullets(
        item(paragraph(text("☐ "), text("読む"))),
        item(
          paragraph(text("☑ 書く")),
          bullets(item(paragraph(text("☐ 練習"))))
        )
      ),
      attrs: { sourceBlockId: "notion-block" }
    })

    expect(result?.[0]).toMatchObject(paragraph(text("前")))
    expect(result?.[1]).toMatchObject({
      type: "taskList",
      attrs: { sourceBlockId: "notion-block" },
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [paragraph(text("読む"))]
        },
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [
            paragraph(text("書く")),
            {
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [paragraph(text("練習"))]
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it("leaves mixed lists, plain bullets and glyphs mid-text alone", () => {
    expect(
      convert(
        bullets(item(paragraph(text("☐ 読む"))), item(paragraph(text("迷う")))),
        bullets(item(paragraph(text("箇条書き")))),
        paragraph(text("☐ not a list"))
      )
    ).toBeUndefined()
  })

  it("converts a nested checkbox list inside a plain bullet", () => {
    const result = convert(
      bullets(
        item(paragraph(text("親")), bullets(item(paragraph(text("☑ 子")))))
      )
    )
    expect(result?.[0]).toMatchObject({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            paragraph(text("親")),
            {
              type: "taskList",
              content: [{ type: "taskItem", attrs: { checked: true } }]
            }
          ]
        }
      ]
    })
  })
})
