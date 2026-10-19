import { readdirSync, readFileSync } from "node:fs"

import { beforeAll, describe, expect, it } from "vite-plus/test"

import { createAnalyzer } from "../src/index"
import type { AnalyzedText, JapaneseAnalyzer, Word } from "../src/index"
import { createKuromojiEngine } from "../src/kuromoji"
import { createNodeDictionaryLoader } from "../src/loaders/node"

interface GoldenFixture {
  text: string
  words: string[]
  phrases?: string[]
  notes?: string
}

const FIXTURE_DIR = new URL("fixtures/", import.meta.url)
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".json"))
  .toSorted()
  .map((name) => ({
    fixture: JSON.parse(
      readFileSync(new URL(name, FIXTURE_DIR), "utf-8")
    ) as GoldenFixture,
    name
  }))

const DICTIONARY_LOAD_TIMEOUT_MS = 30_000

let analyzer: JapaneseAnalyzer

beforeAll(async () => {
  const engine = await createKuromojiEngine({
    loader: createNodeDictionaryLoader()
  })
  analyzer = createAnalyzer({ engine })
}, DICTIONARY_LOAD_TIMEOUT_MS)

function findWord(result: AnalyzedText, surface: string): Word {
  const word = result.words.find((candidate) => candidate.surface === surface)
  if (!word) {
    throw new Error(
      `No word "${surface}" in ${result.words.map((w) => w.surface).join(" | ")}`
    )
  }
  return word
}

function sliceOf(result: AnalyzedText, span: { start: number; end: number }) {
  return result.text.slice(span.start, span.end)
}

describe("golden fixtures", () => {
  it("covers at least 25 sentences", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(25)
  })

  for (const { name, fixture } of fixtures) {
    it(`${name}: ${fixture.text}`, async () => {
      const result = await analyzer.analyze(fixture.text)

      expect(result.words.map((word) => word.surface)).toEqual(fixture.words)
      if (fixture.phrases) {
        expect(result.phrases.map((phrase) => sliceOf(result, phrase))).toEqual(
          fixture.phrases
        )
      }

      // Offsets must point into the original text, morphemes must tile it.
      let cursor = 0
      for (const morpheme of result.morphemes) {
        expect(morpheme.start).toBe(cursor)
        expect(sliceOf(result, morpheme)).toBe(morpheme.surface)
        cursor = morpheme.end
      }
      expect(cursor).toBe(fixture.text.length)
      for (const word of result.words) {
        expect(sliceOf(result, word)).toBe(word.surface)
      }
    })
  }
})

describe("targeted word assertions", () => {
  it("keeps 食べてみました as one verb with a tail and per-kanji ruby", async () => {
    const result = await analyzer.analyze(
      "昨日、友達と駅前の新しい店で寿司を食べてみました。"
    )
    const verb = findWord(result, "食べてみました")
    expect(verb.pos).toBe("verb")
    expect(verb.baseForm).toBe("食べる")
    expect(verb.reading).toBe("たべてみました")
    expect(verb.romaji).toBe("tabete mimashita")
    expect(verb.ruby).toEqual([
      { reading: "た", text: "食" },
      { text: "べてみました" }
    ])
    expect(verb.tail && sliceOf(result, verb.tail)).toBe("てみました")
    expect(verb.morphemeIndexes).toHaveLength(5)

    expect(findWord(result, "昨日").ruby).toEqual([
      { reading: "きのう", text: "昨日" }
    ])
    expect(findWord(result, "友達").ruby).toEqual([
      { reading: "ともだち", text: "友達" }
    ])
    expect(findWord(result, "新しい").ruby).toEqual([
      { reading: "あたら", text: "新" },
      { text: "しい" }
    ])
    expect(findWord(result, "新しい").pos).toBe("adjective")
    expect(findWord(result, "、").isPunctuation).toBe(true)
    expect(findWord(result, "、").pos).toBe("expression")
    expect(findWord(result, "と").pos).toBe("particle")
  })

  it("romanizes helper verbs as separate words and particles by sound", async () => {
    const result = await analyzer.analyze("もう一度行きたいと思っています。")
    expect(findWord(result, "思っています").romaji).toBe("omotte imasu")
    expect(findWord(result, "思っています").baseForm).toBe("思う")
    expect(findWord(result, "行きたい").tail).not.toBeNull()
    expect(findWord(result, "もう一度").pos).toBe("adverb")

    const topic = await analyzer.analyze(
      "田中さんは二〇二六年に東京へ引っ越します。"
    )
    expect(findWord(topic, "は").romaji).toBe("wa")
    expect(findWord(topic, "へ").romaji).toBe("e")
    expect(findWord(topic, "東京").romaji).toBe("toukyou")
    expect(findWord(topic, "田中さん").baseForm).toBe("田中さん")
  })

  it("joins サ変 nouns with する into a verb word", async () => {
    const result = await analyzer.analyze("毎日図書館で日本語を勉強しました。")
    const verb = findWord(result, "勉強しました")
    expect(verb.pos).toBe("verb")
    expect(verb.baseForm).toBe("勉強する")
    expect(verb.tail && sliceOf(result, verb.tail)).toBe("ました")
  })

  it("keeps な separate from a 形容動詞語幹", async () => {
    const result = await analyzer.analyze("静かな部屋で音楽を聴きます。")
    expect(findWord(result, "静か").pos).toBe("adjective")
    expect(findWord(result, "な").pos).toBe("auxiliary")
    expect(sliceOf(result, result.phrases[0] ?? { end: 0, start: 0 })).toBe(
      "静かな"
    )
  })

  it("handles pronouns, verb tails and nouns without tails", async () => {
    const result = await analyzer.analyze("彼に手紙を書いてしまった。")
    expect(findWord(result, "彼").pos).toBe("pronoun")
    expect(findWord(result, "手紙").tail).toBeNull()
    const verb = findWord(result, "書いてしまった")
    expect(verb.baseForm).toBe("書く")
    expect(verb.romaji).toBe("kaite shimatta")
  })

  it("gives katakana loans a reading but no ruby", async () => {
    const result = await analyzer.analyze("朝はいつもコーヒーを飲みます。")
    const coffee = findWord(result, "コーヒー")
    expect(coffee.ruby).toBeNull()
    expect(coffee.reading).toBe("こーひー")
    expect(coffee.romaji).toBe("koohii")
    expect(findWord(result, "いつも").ruby).toBeNull()
  })

  it("leaves reading-less Latin and digit spans without ruby/romaji", async () => {
    const result = await analyzer.analyze("iPhoneを2台買った。")
    const phone = findWord(result, "iPhone")
    expect(phone.reading).toBeNull()
    expect(phone.romaji).toBeNull()
    expect(phone.ruby).toBeNull()
    expect(findWord(result, "2台").romaji).toBeNull()
    expect(findWord(result, "買った").baseForm).toBe("買う")
  })

  it("joins a prefix with its noun", async () => {
    const result = await analyzer.analyze("お水をください。")
    const water = findWord(result, "お水")
    expect(water.pos).toBe("noun")
    expect(water.morphemeIndexes).toHaveLength(2)
    expect(water.ruby).toEqual([
      { text: "お" },
      { reading: "みず", text: "水" }
    ])
  })

  it("reports English-only text as non-Japanese without throwing", async () => {
    const result = await analyzer.analyze("Hello world.")
    expect(result.containsJapanese).toBe(false)
    expect(result.engine.id).toBe("kuromoji-ipadic")
    expect(findWord(result, ".").isPunctuation).toBe(true)
  })

  it("computes UTF-16 offsets around surrogate pairs and skips whitespace words", async () => {
    // kuromoji's own word_position counts code points; 𠮷 is 2 UTF-16 units.
    const result = await analyzer.analyze("𠮷野家で\n食べる")
    expect(findWord(result, "野家").start).toBe(2)
    expect(result.words.map((word) => word.surface)).toEqual([
      "𠮷",
      "野家",
      "で",
      "食べる"
    ])
    expect(findWord(result, "𠮷").isPunctuation).toBe(false)
    expect(result.morphemes.some((m) => m.surface === "\n")).toBe(true)
  })

  it(
    "omits romaji when disabled",
    async () => {
      const engine = await createKuromojiEngine({
        loader: createNodeDictionaryLoader()
      })
      const result = await createAnalyzer({ engine, romaji: false }).analyze(
        "寿司を食べてみました。"
      )
      expect(result.words.every((word) => word.romaji === null)).toBe(true)
      expect(
        result.morphemes.every((morpheme) => morpheme.romaji === null)
      ).toBe(true)
      expect(findWord(result, "寿司").ruby).toEqual([
        { reading: "すし", text: "寿司" }
      ])
    },
    DICTIONARY_LOAD_TIMEOUT_MS
  )
})
