import { describe, expect, it } from "vite-plus/test"

import { alignRuby, toHiraganaReading } from "../src/pipeline/reading"

describe("alignRuby", () => {
  it("uses kana runs as anchors for each kanji run", () => {
    expect(alignRuby("新しい", "あたらしい")).toEqual([
      { reading: "あたら", text: "新" },
      { text: "しい" }
    ])
    expect(alignRuby("引っ越し", "ひっこし")).toEqual([
      { reading: "ひ", text: "引" },
      { text: "っ" },
      { reading: "こ", text: "越" },
      { text: "し" }
    ])
    expect(alignRuby("聞い", "きい")).toEqual([
      { reading: "き", text: "聞" },
      { text: "い" }
    ])
  })

  it("puts one ruby over a pure kanji run", () => {
    expect(alignRuby("友達", "ともだち")).toEqual([
      { reading: "ともだち", text: "友達" }
    ])
    expect(alignRuby("人々", "ひとびと")).toEqual([
      { reading: "ひとびと", text: "人々" }
    ])
  })

  it("falls back to whole-surface ruby when anchors are ambiguous or missing", () => {
    // The か anchor fits at two positions, so neither split is trusted.
    expect(alignRuby("赤か青", "かかかか")).toEqual([
      { reading: "かかかか", text: "赤か青" }
    ])
    expect(alignRuby("行き", "ゆく")).toEqual([
      { reading: "ゆく", text: "行き" }
    ])
  })

  it("returns null for kana-only surfaces", () => {
    expect(alignRuby("パン", "ぱん")).toBeNull()
    expect(alignRuby("いつも", "いつも")).toBeNull()
  })
})

describe("toHiraganaReading", () => {
  it("keeps the long vowel mark", () => {
    expect(toHiraganaReading("コーヒー")).toBe("こーひー")
    expect(toHiraganaReading("キノウ")).toBe("きのう")
  })
})
