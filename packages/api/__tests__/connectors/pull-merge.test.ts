import { describe, expect, it } from "vite-plus/test"

import {
  baseFromImport,
  mergePull,
  sameBlock
} from "../../src/connectors/pull-merge"
import type { IncomingBlock } from "../../src/connectors/pull-merge"
import type { PMDoc, PMNode } from "../../src/importers/types"
import { assertValidDoc } from "../../src/importers/validate"

const para = (text: string, key: string | null = null): PMNode => ({
  type: "paragraph",
  attrs: key ? { sourceBlockId: key } : {},
  content: [{ type: "text", text }]
})
const block = (key: string, text: string, rev = "r1"): IncomingBlock => ({
  key,
  rev,
  node: para(text, key)
})
const doc = (...content: PMNode[]): PMDoc => ({ type: "doc", content })
const texts = (result: PMDoc): string[] =>
  result.content.map((node) => node.content?.[0]?.text ?? "")

const imported = [block("a", "迷う"), block("b", "稼ぐ"), block("c", "行く")]
const base = baseFromImport(imported)
const untouched = doc(...imported.map((entry) => entry.node))

describe("mergePull", () => {
  it("takes source changes when the entry is untouched", () => {
    const result = mergePull(untouched, base, [
      block("a", "迷う"),
      block("b", "稼ぐ（更新）", "r2"),
      block("c", "行く")
    ])
    expect(texts(result.doc)).toEqual(["迷う", "稼ぐ（更新）", "行く"])
    expect(result.stats).toEqual({ updated: 1, added: 0, removed: 0 })
    expect(result.taken).toEqual(["b"])
    expect(result.conflicts).toEqual([])
    assertValidDoc(result.doc)
  })

  it("keeps a local edit when the source did not change", () => {
    const local = doc(
      para("迷う", "a"),
      para("稼ぐ ← my note", "b"),
      para("行く", "c")
    )
    const result = mergePull(local, base, imported)
    expect(texts(result.doc)).toEqual(["迷う", "稼ぐ ← my note", "行く"])
    expect(result.conflicts).toEqual([])
  })

  it("reports a conflict when both sides changed and keeps the local block", () => {
    const local = doc(
      para("迷う", "a"),
      para("稼ぐ ← mine", "b"),
      para("行く", "c")
    )
    const result = mergePull(local, base, [
      block("a", "迷う"),
      block("b", "稼ぐ ← theirs", "r2"),
      block("c", "行く")
    ])
    expect(texts(result.doc)).toEqual(["迷う", "稼ぐ ← mine", "行く"])
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.key).toBe("b")
    // base stays at the old revision until the user resolves it
    expect(result.base.blocks.b?.rev).toBe("r1")
  })

  it("keeps the user's own blocks after the block they followed", () => {
    const local = doc(
      para("my intro"),
      para("迷う", "a"),
      para("note on 迷う"),
      para("稼ぐ", "b"),
      para("行く", "c")
    )
    const result = mergePull(local, base, [
      block("c", "行く"),
      block("a", "迷う（更新）", "r2"),
      block("b", "稼ぐ")
    ])
    expect(texts(result.doc)).toEqual([
      "my intro",
      "行く",
      "迷う（更新）",
      "note on 迷う",
      "稼ぐ"
    ])
  })

  it("inserts new source blocks and drops untouched deleted ones", () => {
    const local = doc(
      para("迷う", "a"),
      para("稼ぐ", "b"),
      para("note"),
      para("行く", "c")
    )
    const result = mergePull(local, base, [
      block("a", "迷う"),
      block("d", "来る"),
      block("c", "行く")
    ])
    // b is gone; its follower moves to the nearest earlier surviving block (a)
    expect(texts(result.doc)).toEqual(["迷う", "note", "来る", "行く"])
    expect(result.stats).toEqual({ updated: 0, added: 1, removed: 1 })
  })

  it("keeps a deleted-upstream block the user had edited, as the user's", () => {
    const local = doc(
      para("迷う", "a"),
      para("稼ぐ ← mine", "b"),
      para("行く", "c")
    )
    const result = mergePull(local, base, [
      block("a", "迷う"),
      block("c", "行く")
    ])
    expect(texts(result.doc)).toEqual(["迷う", "稼ぐ ← mine", "行く"])
    expect(result.doc.content[1]?.attrs?.sourceBlockId).toBeNull()
  })

  it("respects a local deletion even when the source changed", () => {
    const local = doc(para("迷う", "a"), para("行く", "c"))
    const result = mergePull(local, base, [
      block("a", "迷う"),
      block("b", "稼ぐ（更新）", "r2"),
      block("c", "行く")
    ])
    expect(texts(result.doc)).toEqual(["迷う", "行く"])
    expect(result.base.blocks.b?.rev).toBe("r2")
  })

  it("treats a pasted duplicate of an imported block as the user's copy", () => {
    const local = doc(
      para("迷う", "a"),
      para("迷う", "a"),
      para("稼ぐ", "b"),
      para("行く", "c")
    )
    const result = mergePull(local, base, [
      block("a", "迷う（更新）", "r2"),
      block("b", "稼ぐ"),
      block("c", "行く")
    ])
    expect(texts(result.doc)).toEqual(["迷う（更新）", "迷う", "稼ぐ", "行く"])
    expect(result.doc.content[1]?.attrs?.sourceBlockId).toBeNull()
  })
})

describe("sameBlock", () => {
  it("ignores default attributes the editor fills in and fold state", () => {
    const fromConverter: PMNode = {
      type: "heading",
      attrs: { level: 2, sourceBlockId: "h" },
      content: [{ type: "text", text: "動詞" }]
    }
    const fromEditor: PMNode = {
      type: "heading",
      attrs: { level: 2, collapsed: true, sourceBlockId: "h" },
      content: [{ type: "text", text: "動詞" }]
    }
    expect(sameBlock(fromConverter, fromEditor)).toBe(true)
    expect(
      sameBlock(fromConverter, {
        ...fromEditor,
        content: [{ type: "text", text: "形容詞" }]
      })
    ).toBe(false)
  })
})
