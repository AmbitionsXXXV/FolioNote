import { describe, expect, it } from "vite-plus/test"

import { chunkSentences, splitArticle } from "../src"

describe("article parsing", () => {
  it("recognizes a short title followed by a blank line", () => {
    expect(splitArticle("日本の朝\n\n朝です。\n出かけます！").title).toBe(
      "日本の朝"
    )
    expect(splitArticle("日本の朝\n朝です。").title).toBeNull()
    expect(splitArticle(`${"朝".repeat(41)}\n\n本文。`).title).toBeNull()
    expect(splitArticle(`${"朝".repeat(40)}\n\n本文。`).title).toHaveLength(40)
  })

  it("keeps closing brackets with sentence endings and breaks at newlines", () => {
    const text = "「行きます！」次です。\n『本当？』そうです!?（はい。）終わり"
    expect(
      splitArticle(text).sentences.map(({ start, end }) =>
        text.slice(start, end)
      )
    ).toEqual([
      "「行きます！」",
      "次です。",
      "『本当？』",
      "そうです!?",
      "（はい。）",
      "終わり"
    ])
  })

  it("normalizes CRLF for parsing while preserving input offsets", () => {
    const text = "題\r\n\r\n一。\r\n二！\r\n\r\n三。"
    const parsed = splitArticle(text)
    expect(parsed.title).toBe("題")
    expect(
      parsed.paragraphs.map(({ start, end }) => text.slice(start, end))
    ).toEqual(["題", "一。\r\n二！", "三。"])
    expect(
      parsed.sentences.map(({ start, end }) => text.slice(start, end))
    ).toEqual(["題", "一。", "二！", "三。"])
    expect(parsed.sentences.at(-1)).toEqual({
      start: text.indexOf("三"),
      end: text.length
    })
  })

  it("packs whole sentences, hard-splits long ones, and preserves every input character", () => {
    const text = "一。二。\n長い長い長い長い。終。  "
    const chunks = chunkSentences(text, splitArticle(text).sentences, 5)
    expect(
      chunks.map(({ start, end }) => text.slice(start, end)).join("")
    ).toBe(text)
    expect(chunks[0]).toEqual({ start: 0, end: 5 })
    for (const [index, chunk] of chunks.entries()) {
      expect(chunk.end - chunk.start).toBeLessThanOrEqual(5)
      expect(chunk.start).toBe(index === 0 ? 0 : chunks[index - 1]?.end)
    }
  })

  it("handles empty text and rejects invalid chunk sizes", () => {
    expect(splitArticle("")).toEqual({
      title: null,
      paragraphs: [],
      sentences: []
    })
    expect(chunkSentences("", [], 10)).toEqual([])
    expect(() => chunkSentences("文", [], 0)).toThrow(RangeError)
    expect(() => chunkSentences("文", [], 1.5)).toThrow(RangeError)
    expect(chunkSentences("abcd", [], 2)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 }
    ])
  })

  it("does not split a short sentence when its preceding whitespace fills a chunk", () => {
    const text = "   猫。"
    const chunks = chunkSentences(text, splitArticle(text).sentences, 4)
    expect(chunks.map(({ start, end }) => text.slice(start, end))).toEqual([
      "   ",
      "猫。"
    ])
  })
})
