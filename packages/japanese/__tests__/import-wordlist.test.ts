import { describe, expect, it } from "vite-plus/test"

import { guessColumnRoles, parseWordList } from "../src"

describe("word list parsing", () => {
  it("parses RFC-4180 quotes, escaped quotes and embedded newlines", () => {
    const result = parseWordList(
      'word,meaning\r\n猫,"cat, feline"\r\n犬,"a ""dog""\r\non two lines"\r\n'
    )
    expect(result).toEqual({
      format: "csv",
      hasHeader: true,
      columns: ["word", "meaning"],
      rows: [
        ["猫", "cat, feline"],
        ["犬", 'a "dog"\r\non two lines']
      ],
      issues: []
    })
  })

  it("strips BOM, detects TSV, and guesses Chinese headers", () => {
    const parsed = parseWordList(
      "\uFEFF单词\t读音\t释义\t词性\t单元\n猫\tねこ\t猫\t名词\t1"
    )
    expect(parsed.format).toBe("tsv")
    expect(parsed.hasHeader).toBe(true)
    expect(guessColumnRoles(parsed.columns, parsed.rows)).toEqual([
      "headword",
      "reading",
      "meaning",
      "pos",
      "unit"
    ])
  })

  it("reads Anki comments and HTML without dropping quoted comment-like lines", () => {
    const parsed = parseWordList(
      '#separator:tab\n#html:true\n"<b>猫</b>"\t"cat&nbsp;animal"\n犬\t"dog\n#still a field"'
    )
    expect(parsed.format).toBe("anki")
    expect(parsed.rows).toEqual([
      ["猫", "cat animal"],
      ["犬", "dog\n#still a field"]
    ])
    expect(parsed.columns).toEqual(["Column A", "Column B"])
    expect(
      parseWordList("#note\n<b>猫</b>\tcat", { format: "anki" }).rows
    ).toEqual([["猫", "cat"]])
  })

  it("infers roles from headerless data", () => {
    const parsed = parseWordList(
      "食べる\tたべる\tto eat\t1\n飲む\tのむ\tto drink\t2"
    )
    expect(parsed.hasHeader).toBe(false)
    expect(guessColumnRoles(parsed.columns, parsed.rows)).toEqual([
      "headword",
      "reading",
      "meaning",
      "unit"
    ])
    expect(
      guessColumnRoles(["単語", "読み", "意味", "品詞", "課", "extra"], [])
    ).toEqual(["headword", "reading", "meaning", "pos", "unit", "ignore"])
  })

  it("reports malformed records and respects an explicit format", () => {
    expect(parseWordList('word,meaning\n猫,"unclosed').issues).toContainEqual({
      row: 2,
      message: "Unclosed quoted field"
    })
    expect(parseWordList("word,meaning\n猫,cat,extra").issues).toContainEqual({
      row: 2,
      message: "Expected 2 columns, received 3"
    })
    expect(parseWordList("cat,dog\tfish", { format: "tsv" }).rows).toEqual([
      ["cat,dog", "fish"]
    ])
    expect(parseWordList("").rows).toEqual([])
  })
})
