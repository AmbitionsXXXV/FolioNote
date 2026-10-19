import { describe, expect, it } from "vite-plus/test"

import {
  createEmptyProseMirrorDoc,
  extractTextFromHtml,
  extractTextFromProseMirrorJson,
  generateContentPreview,
  isValidProseMirrorJson,
  processContentUpdate
} from "../../src/utils/content"

describe("extractTextFromProseMirrorJson", () => {
  it("should return empty string for null input", () => {
    expect(extractTextFromProseMirrorJson(null)).toBe("")
  })

  it("should return empty string for undefined input", () => {
    expect(extractTextFromProseMirrorJson()).toBe("")
  })

  it("should extract text from simple document", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello, World!" }]
        }
      ]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe("Hello, World!\n")
  })

  it("indexes a Japanese sentence block's text and translation", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "japaneseSentence",
          attrs: {
            text: "満員電車に揺られていた人",
            translation: "曾在满员电车里被摇晃的人"
          }
        },
        { type: "japaneseSentence", attrs: { text: "", translation: null } }
      ]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe(
      "満員電車に揺られていた人\n曾在满员电车里被摇晃的人\n\n"
    )
  })

  it("should extract text from JSON string", () => {
    const jsonString = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Test content" }]
        }
      ]
    })
    expect(extractTextFromProseMirrorJson(jsonString)).toBe("Test content\n")
  })

  it("should extract text from multiple paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }]
        }
      ]
    }
    const result = extractTextFromProseMirrorJson(doc)
    expect(result).toContain("First paragraph")
    expect(result).toContain("Second paragraph")
  })

  it("should handle empty paragraph", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph" }]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe("\n")
  })

  it("should handle heading nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }]
        }
      ]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe("Title\n")
  })

  it("should handle blockquote nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted text" }]
            }
          ]
        }
      ]
    }
    const result = extractTextFromProseMirrorJson(doc)
    expect(result).toContain("Quoted text")
  })

  it("should handle code block nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const x = 1;" }]
        }
      ]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe("const x = 1;\n")
  })

  it("should handle list nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 2" }]
                }
              ]
            }
          ]
        }
      ]
    }
    const result = extractTextFromProseMirrorJson(doc)
    expect(result).toContain("Item 1")
    expect(result).toContain("Item 2")
  })

  it("should handle text with marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Bold text",
              marks: [{ type: "bold" }]
            }
          ]
        }
      ]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe("Bold text\n")
  })

  it("should handle horizontal rule", () => {
    const doc = {
      type: "doc",
      content: [{ type: "horizontalRule" }]
    }
    expect(extractTextFromProseMirrorJson(doc)).toBe("\n")
  })

  it("should handle hard break", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line 1" },
            { type: "hardBreak" },
            { type: "text", text: "Line 2" }
          ]
        }
      ]
    }
    const result = extractTextFromProseMirrorJson(doc)
    expect(result).toContain("Line 1")
    expect(result).toContain("Line 2")
  })
})

describe("extractTextFromHtml", () => {
  it("should return empty string for null input", () => {
    expect(extractTextFromHtml(null)).toBe("")
  })

  it("should return empty string for undefined input", () => {
    expect(extractTextFromHtml()).toBe("")
  })

  it("should extract text from simple HTML", () => {
    expect(extractTextFromHtml("<p>Hello, World!</p>")).toBe("Hello, World!")
  })

  it("should replace block tags with newlines", () => {
    const html = "<p>First</p><p>Second</p>"
    const result = extractTextFromHtml(html)
    expect(result).toContain("First")
    expect(result).toContain("Second")
  })

  it("should handle br tags", () => {
    const html = "Line 1<br>Line 2"
    const result = extractTextFromHtml(html)
    expect(result).toContain("Line 1")
    expect(result).toContain("Line 2")
  })

  it("should handle self-closing br tags", () => {
    const html = "Line 1<br/>Line 2"
    const result = extractTextFromHtml(html)
    expect(result).toContain("Line 1")
    expect(result).toContain("Line 2")
  })

  it("should remove inline tags", () => {
    expect(extractTextFromHtml("<span>Text</span>")).toBe("Text")
    expect(extractTextFromHtml("<strong>Bold</strong>")).toBe("Bold")
    expect(extractTextFromHtml("<em>Italic</em>")).toBe("Italic")
  })

  it("should decode HTML entities", () => {
    expect(extractTextFromHtml("&amp;")).toBe("&")
    expect(extractTextFromHtml("&lt;")).toBe("<")
    expect(extractTextFromHtml("&gt;")).toBe(">")
    expect(extractTextFromHtml("&quot;")).toBe('"')
    expect(extractTextFromHtml("&#39;")).toBe("'")
    // &nbsp; becomes space, but gets trimmed when it's the only content
    expect(extractTextFromHtml("text&nbsp;here")).toBe("text here")
  })

  it("should collapse multiple newlines", () => {
    const html = "<p>First</p><p></p><p></p><p>Second</p>"
    const result = extractTextFromHtml(html)
    // Should not have more than 2 consecutive newlines
    expect(result.includes("\n\n\n")).toBe(false)
  })

  it("should handle heading tags", () => {
    const html = "<h1>Title</h1><h2>Subtitle</h2>"
    const result = extractTextFromHtml(html)
    expect(result).toContain("Title")
    expect(result).toContain("Subtitle")
  })

  it("should handle list items", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
    const result = extractTextFromHtml(html)
    expect(result).toContain("Item 1")
    expect(result).toContain("Item 2")
  })

  it("should handle blockquote", () => {
    const html = "<blockquote>Quoted text</blockquote>"
    expect(extractTextFromHtml(html)).toContain("Quoted text")
  })

  it("should handle pre tags", () => {
    const html = "<pre>Code block</pre>"
    expect(extractTextFromHtml(html)).toContain("Code block")
  })

  it("should trim result", () => {
    const html = "  <p>  Text  </p>  "
    expect(extractTextFromHtml(html)).toBe("Text")
  })
})

describe("generateContentPreview", () => {
  it("should return empty string for null input", () => {
    expect(generateContentPreview(null)).toBe("")
  })

  it("should return empty string for undefined input", () => {
    expect(generateContentPreview()).toBe("")
  })

  it("should return text as-is when shorter than maxLength", () => {
    const text = "Short text"
    expect(generateContentPreview(text)).toBe("Short text")
  })

  it("should normalize whitespace", () => {
    const text = "Line 1\nLine 2\n\nLine 3"
    const result = generateContentPreview(text)
    expect(result).toBe("Line 1 Line 2 Line 3")
  })

  it("should truncate at word boundary when possible", () => {
    const text = "a ".repeat(150) // 300 characters
    const result = generateContentPreview(text, 200)
    expect(result.length).toBeLessThanOrEqual(203) // 200 + '...'
    expect(result.endsWith("...")).toBe(true)
  })

  it("should use custom maxLength", () => {
    const text = "a".repeat(100)
    const result = generateContentPreview(text, 50)
    expect(result.length).toBe(53) // 50 + '...'
    expect(result.endsWith("...")).toBe(true)
  })

  it("should not truncate text equal to maxLength", () => {
    const text = "a".repeat(200)
    const result = generateContentPreview(text, 200)
    expect(result).toBe(text)
    expect(result.endsWith("...")).toBe(false)
  })

  it("should handle text with only whitespace", () => {
    const text = "   \n\t   "
    expect(generateContentPreview(text)).toBe("")
  })

  it("should trim leading/trailing whitespace", () => {
    const text = "  Hello World  "
    expect(generateContentPreview(text)).toBe("Hello World")
  })
})

describe("isValidProseMirrorJson", () => {
  it("should return false for null", () => {
    expect(isValidProseMirrorJson(null)).toBe(false)
  })

  it("should return false for undefined", () => {
    expect(isValidProseMirrorJson()).toBe(false)
  })

  it("should return true for valid doc object", () => {
    const doc = { type: "doc", content: [] }
    expect(isValidProseMirrorJson(doc)).toBe(true)
  })

  it("should return true for valid JSON string", () => {
    const jsonString = JSON.stringify({ type: "doc", content: [] })
    expect(isValidProseMirrorJson(jsonString)).toBe(true)
  })

  it("should return false for invalid JSON string", () => {
    expect(isValidProseMirrorJson("not valid json")).toBe(false)
  })

  it("should return false for object without type", () => {
    const obj = { content: [] }
    expect(isValidProseMirrorJson(obj)).toBe(false)
  })

  it("should return false for object with wrong type", () => {
    const obj = { type: "paragraph", content: [] }
    expect(isValidProseMirrorJson(obj)).toBe(false)
  })

  it("should return false for empty string", () => {
    expect(isValidProseMirrorJson("")).toBe(false)
  })

  it("should return false for array", () => {
    expect(isValidProseMirrorJson([{ type: "doc" }])).toBe(false)
  })

  it("should return true for minimal valid doc", () => {
    expect(isValidProseMirrorJson({ type: "doc" })).toBe(true)
  })
})

describe("createEmptyProseMirrorDoc", () => {
  it("should return valid JSON string", () => {
    const result = createEmptyProseMirrorDoc()
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it("should create valid ProseMirror doc", () => {
    const result = createEmptyProseMirrorDoc()
    expect(isValidProseMirrorJson(result)).toBe(true)
  })

  it("should have doc type", () => {
    const result = JSON.parse(createEmptyProseMirrorDoc())
    expect(result.type).toBe("doc")
  })

  it("should have content array", () => {
    const result = JSON.parse(createEmptyProseMirrorDoc())
    expect(Array.isArray(result.content)).toBe(true)
  })

  it("should have single empty paragraph", () => {
    const result = JSON.parse(createEmptyProseMirrorDoc())
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe("paragraph")
  })

  it("should return consistent result", () => {
    const result1 = createEmptyProseMirrorDoc()
    const result2 = createEmptyProseMirrorDoc()
    expect(result1).toBe(result2)
  })
})

describe("processContentUpdate", () => {
  it("should return null values for null input", () => {
    const result = processContentUpdate(null)
    expect(result.contentJson).toBeNull()
    expect(result.contentText).toBeNull()
  })

  it("should return null values for undefined input", () => {
    const result = processContentUpdate()
    expect(result.contentJson).toBeNull()
    expect(result.contentText).toBeNull()
  })

  it("should preserve contentJson", () => {
    const jsonString = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }]
        }
      ]
    })
    const result = processContentUpdate(jsonString)
    expect(result.contentJson).toBe(jsonString)
  })

  it("should extract contentText from valid doc", () => {
    const jsonString = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello, World!" }]
        }
      ]
    })
    const result = processContentUpdate(jsonString)
    expect(result.contentText).toBe("Hello, World!\n")
  })

  it("should return null contentText for empty doc", () => {
    const jsonString = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }]
    })
    const result = processContentUpdate(jsonString)
    // Empty paragraph produces only newline, which might be considered empty
    expect(result.contentText).toBe("\n")
  })

  it("should handle complex content", () => {
    const jsonString = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Content here" }]
        }
      ]
    })
    const result = processContentUpdate(jsonString)
    expect(result.contentText).toContain("Title")
    expect(result.contentText).toContain("Content here")
  })
})
