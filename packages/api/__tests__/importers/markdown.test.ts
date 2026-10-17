import { describe, expect, it } from "vite-plus/test"

import { markdownToDoc } from "../../src/importers/markdown"
import { assertValidDoc, emptyDoc } from "../../src/importers/validate"

describe("Markdown import", () => {
  it("uses the first heading as the title after leading blank lines", () => {
    const result = markdownToDoc("\n\n# 日本語\n\n来る")
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.title).toBe("日本語")
    expect(result.doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "来る" }] }
    ])
  })
  it("extracts an H1 title and converts a Japanese GFM lesson", () => {
    const result = markdownToDoc(
      [
        "# 日本語の動詞",
        "",
        "## 活用",
        "",
        "| 辞書形 | 否定形 |",
        "| :--- | ---: |",
        "| 迷う | 迷わない |",
        "| 来る | 来ない |",
        "",
        "- [ ] 読む",
        "- [x] 書く",
        "  1. 練習する",
        "  2. 復習する",
        "",
        "```ts",
        'const word = "来る"',
        "```",
        "",
        "---"
      ].join("\n")
    )
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.title).toBe("日本語の動詞")
    expect(result.doc.content.map((node) => node.type)).toEqual([
      "heading",
      "table",
      "bulletList",
      "codeBlock",
      "horizontalRule"
    ])
    expect(result.doc.content[0].attrs?.level).toBe(2)
    const table = result.doc.content[1]
    expect(table.content?.[0].content?.[1]).toMatchObject({
      type: "tableHeader",
      attrs: { textAlign: "right" },
      content: [{ type: "paragraph", content: [{ text: "否定形" }] }]
    })
    expect(table.content?.[1].content?.[0]).toMatchObject({
      type: "tableCell",
      attrs: { textAlign: "left" },
      content: [{ type: "paragraph", content: [{ text: "迷う" }] }]
    })
    expect(
      result.doc.content[2].content?.map(
        (item) => item.content?.[0].content?.[0].text
      )
    ).toEqual(["☐ ", "☑ "])
    expect(result.doc.content[2].content?.[1].content?.[1]).toMatchObject({
      type: "orderedList",
      attrs: { start: 1 },
      content: [{ type: "listItem" }, { type: "listItem" }]
    })
    expect(result.doc.content[3]).toMatchObject({
      attrs: { language: "typescript" },
      content: [{ text: 'const word = "来る"' }]
    })
    expect(result.warnings).toEqual([
      { kind: "to_do", from: "Checklist", to: "Checklist as list", count: 2 }
    ])
    expect(result.assetUrls).toEqual([])
  })

  it("preserves inline formatting, links, escapes, breaks and CJK text", () => {
    const result = markdownToDoc(
      "**太字** *斜体* ~~取消~~ `来る` [辞書](https://example.com) \\*文字\\*  \n次の行",
      { titleFallback: "練習" }
    )
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.title).toBe("練習")
    const content = result.doc.content[0].content ?? []
    for (const [text, type] of [
      ["太字", "bold"],
      ["斜体", "italic"],
      ["取消", "strike"],
      ["来る", "code"],
      ["辞書", "link"]
    ]) {
      expect(content.find((node) => node.text === text)?.marks).toEqual(
        expect.arrayContaining([expect.objectContaining({ type })])
      )
    }
    expect(content).toContainEqual({ type: "hardBreak" })
    expect(content.map((node) => node.text ?? "").join("")).toContain(
      "*文字*次の行"
    )
    expect(content.at(-1)?.text).toBe("次の行")
  })

  it("splits paragraphs around block images, including inside lists and tables", () => {
    const result = markdownToDoc(
      '前![来る](https://example.com/a.png "画像")後\n\n- ![表](https://example.com/b.png)\n\n| 写真 |\n| --- |\n| ![例](https://example.com/c.png) |',
      { mapImageUrl: (url) => url.replace("example.com", "cdn.example.com") }
    )
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.doc.content.map((node) => node.type)).toEqual([
      "paragraph",
      "image",
      "paragraph",
      "bulletList",
      "table"
    ])
    expect(result.doc.content[1].attrs).toMatchObject({
      src: "https://cdn.example.com/a.png",
      alt: "来る",
      title: "画像"
    })
    expect(
      result.doc.content[3].content?.[0].content?.map((node) => node.type)
    ).toEqual(["paragraph", "image"])
    expect(
      result.doc.content[4].content?.[1].content?.[0].content?.[0].type
    ).toBe("image")
    expect(result.assetUrls).toEqual([])
  })

  it("retains HTML literally with aggregated warnings and clamps heading levels", () => {
    const result = markdownToDoc(
      "#### 深い見出し\n\n> 引用\n>\n> 3. 一\n> 4. 二\n\n<div>来る</div>\n\n<span>迷う</span>\n\n###### 終わり"
    )
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.title).toBe("Untitled")
    expect(result.doc.content[0].attrs?.level).toBe(3)
    expect(result.doc.content.at(-1)?.attrs?.level).toBe(3)
    expect(result.doc.content[1]).toMatchObject({
      type: "blockquote",
      content: [
        { type: "paragraph" },
        { type: "orderedList", attrs: { start: 3 } }
      ]
    })
    expect(JSON.stringify(result.doc)).toContain("<div>来る</div>")
    expect(result.warnings).toEqual([
      { kind: "html", from: "HTML", to: "Plain text", count: 3 }
    ])
  })

  it.each(["", "\n\n", "# Title", "[reference]: https://example.com"])(
    "creates a valid empty body for %j",
    (markdown) => {
      const result = markdownToDoc(markdown)
      expect(() => assertValidDoc(result.doc)).not.toThrow()
      expect(result.doc).toEqual(emptyDoc())
    }
  )

  it("keeps later H1 headings and handles loose task lists and empty quotes", () => {
    const result = markdownToDoc(
      "前書き\n\n# Body heading\n\n- [x] **来る**\n\n  詳細\n\n- [ ] 迷う\n\n>"
    )
    expect(() => assertValidDoc(result.doc)).not.toThrow()
    expect(result.title).toBe("Untitled")
    expect(result.doc.content[1]).toMatchObject({
      type: "heading",
      attrs: { level: 1 }
    })
    expect(result.doc.content[2].content?.[0].content).toHaveLength(2)
    expect(
      result.doc.content[2].content?.[0].content?.[0].content
        ?.map((node) => node.text)
        .join("")
    ).toBe("☑ 来る")
    expect(result.doc.content.at(-1)).toMatchObject({
      type: "blockquote",
      content: [{ type: "paragraph", content: [] }]
    })
  })

  it("maps fence aliases to the editor's language ids", () => {
    const { doc } = markdownToDoc(
      "```ts\nconst a = 1\n```\n\n```C++\nint a;\n```"
    )
    assertValidDoc(doc)
    expect(doc.content.map((node) => node.attrs?.language)).toEqual([
      "typescript",
      "cpp"
    ])
  })
})
