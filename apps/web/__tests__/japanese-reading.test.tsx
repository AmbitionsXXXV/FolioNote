import type { AnalyzedText, Morpheme, Word } from "@folionote/japanese"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { JapaneseAnalyzedSentenceView } from "../src/components/japanese/japanese-analyzed-sentence"
import type { JapaneseReadingWork } from "../src/components/japanese/japanese-reading-data"
import { JAPANESE_READING_WORKS } from "../src/components/japanese/japanese-reading-data"
import { JapaneseReadingView } from "../src/components/japanese/japanese-reading-view"
import i18n from "../src/lib/i18n"

const analyzeStub = vi.hoisted(() => ({
  mode: "ok" as "ok" | "unavailable"
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  )
}))

vi.mock("@/utils/orpc", () => ({
  // The reading view calls japanese.analyze directly so it can fall back to
  // the in-browser engine when the server answers SERVICE_UNAVAILABLE.
  client: {
    japanese: {
      analyze: ({ text }: { text: string }) => {
        if (analyzeStub.mode === "unavailable") {
          return Promise.reject(
            Object.assign(new Error("Japanese analyzer is not ready"), {
              code: "SERVICE_UNAVAILABLE"
            })
          )
        }
        return Promise.resolve(wholeSentenceAnalysis(text))
      }
    }
  },
  orpc: {
    japanese: {
      // The reader tags words from the user's lists; none exist in this test.
      lexicons: {
        list: {
          queryOptions: () => ({
            queryKey: ["japanese", "lexicons", "list"],
            queryFn: () => Promise.resolve([])
          })
        },
        lookup: {
          queryOptions: ({ input }: { input: { baseForms: string[] } }) => ({
            queryKey: ["japanese", "lexicons", "lookup", input.baseForms],
            queryFn: () => Promise.resolve([])
          })
        }
      }
    }
  }
}))

const morpheme = (
  surface: string,
  start: number,
  pos: string,
  learnerPos: Morpheme["learnerPos"],
  baseForm = surface
): Morpheme => ({
  surface,
  start,
  end: start + surface.length,
  pos,
  posDetail: [],
  conjugatedType: null,
  conjugatedForm: null,
  baseForm,
  reading: null,
  pronunciation: null,
  learnerPos,
  isPunctuation: pos === "記号",
  ruby: null,
  romaji: null
})

/** Test double for japanese.analyze: the whole sentence as one noun word. */
const wholeSentenceAnalysis = (text: string): AnalyzedText => ({
  text,
  engine: { id: "kuromoji-ipadic", dictVersion: "test" },
  containsJapanese: true,
  morphemes: [morpheme(text, 0, "名詞", "noun")],
  words: [
    {
      index: 0,
      start: 0,
      end: text.length,
      surface: text,
      morphemeIndexes: [0],
      pos: "noun",
      baseForm: text,
      reading: null,
      ruby: null,
      romaji: null,
      isPunctuation: false,
      tail: null
    }
  ],
  phrases: [{ index: 0, start: 0, end: text.length, wordIndexes: [0] }]
})

/** 寿司を食べてみました。 as the real engine segments it (fixture tabete-mimashita). */
const SUSHI_ANALYSIS: AnalyzedText = {
  text: "寿司を食べてみました。",
  engine: { id: "kuromoji-ipadic", dictVersion: "test" },
  containsJapanese: true,
  morphemes: [
    morpheme("寿司", 0, "名詞", "noun"),
    morpheme("を", 2, "助詞", "particle"),
    morpheme("食べ", 3, "動詞", "verb", "食べる"),
    morpheme("て", 5, "助詞", "particle"),
    morpheme("み", 6, "動詞", "verb", "みる"),
    morpheme("まし", 7, "助動詞", "auxiliary", "ます"),
    morpheme("た", 9, "助動詞", "auxiliary"),
    morpheme("。", 10, "記号", "expression")
  ],
  words: [
    {
      index: 0,
      start: 0,
      end: 2,
      surface: "寿司",
      morphemeIndexes: [0],
      pos: "noun",
      baseForm: "寿司",
      reading: "すし",
      ruby: [{ text: "寿司", reading: "すし" }],
      romaji: "sushi",
      isPunctuation: false,
      tail: null
    },
    {
      index: 1,
      start: 2,
      end: 3,
      surface: "を",
      morphemeIndexes: [1],
      pos: "particle",
      baseForm: "を",
      reading: "を",
      ruby: null,
      romaji: "o",
      isPunctuation: false,
      tail: null
    },
    {
      index: 2,
      start: 3,
      end: 10,
      surface: "食べてみました",
      morphemeIndexes: [2, 3, 4, 5, 6],
      pos: "verb",
      baseForm: "食べる",
      reading: "たべてみました",
      ruby: [{ text: "食", reading: "た" }, { text: "べてみました" }],
      romaji: "tabete mimashita",
      isPunctuation: false,
      tail: { start: 5, end: 10 }
    },
    {
      index: 3,
      start: 10,
      end: 11,
      surface: "。",
      morphemeIndexes: [7],
      pos: "expression",
      baseForm: "。",
      reading: null,
      ruby: null,
      romaji: null,
      isPunctuation: true,
      tail: null
    }
  ],
  phrases: [
    { index: 0, start: 0, end: 3, wordIndexes: [0, 1] },
    { index: 1, start: 3, end: 11, wordIndexes: [2, 3] }
  ]
}

const ALL_POS = new Set<Word["pos"]>([
  "noun",
  "pronoun",
  "verb",
  "adjective",
  "adverb",
  "particle",
  "auxiliary",
  "expression"
])

const getWork = (id: string): JapaneseReadingWork => {
  const work = JAPANESE_READING_WORKS.find((candidate) => candidate.id === id)
  if (!work) {
    throw new Error(`Expected Japanese reading work "${id}" to exist.`)
  }
  return work
}

const renderView = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <JapaneseReadingView />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe("JAPANESE_READING_WORKS", () => {
  it("keeps traceable public-domain works with plain sentence text", () => {
    expect(JAPANESE_READING_WORKS).toHaveLength(3)

    for (const work of JAPANESE_READING_WORKS) {
      expect(work.sourceName).toBe("青空文庫")
      expect(work.sourceUrl).toMatch(/^https:\/\/www\.aozora\.gr\.jp\//)
      expect(work.rights).toBe("public-domain")
      expect(work.sentences.length).toBeGreaterThan(0)

      for (const sentence of work.sentences) {
        expect(sentence.text.length).toBeGreaterThan(0)
        expect(sentence.text.length).toBeLessThanOrEqual(2000)
        expect(sentence.translations["en-US"]).not.toBe("")
        expect(sentence.translations["ja-JP"]).not.toBe("")
        expect(sentence.translations["zh-CN"]).not.toBe("")
      }
    }
  })
})

describe("JapaneseAnalyzedSentenceView", () => {
  const renderSentence = (
    unit: "word" | "phrase" | "morpheme",
    selectedWordIndex: number | null = null
  ) => {
    const onSelectWord = vi.fn()
    render(
      <JapaneseAnalyzedSentenceView
        analysis={SUSHI_ANALYSIS}
        enabledPosCategories={ALL_POS}
        onSelectWord={onSelectWord}
        selectedWordIndex={selectedWordIndex}
        showFurigana
        showRomaji
        unit={unit}
      />
    )
    return onSelectWord
  }

  it("renders words as buttons with ruby, romaji and a split inflection tail", () => {
    const onSelectWord = renderSentence("word")

    const buttons = screen.getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual([
      "寿司すしsushi",
      "をo",
      "食たべてみましたtabete mimashita"
    ])
    expect(screen.queryByRole("button", { name: /。/ })).toBeNull()
    expect(screen.getByText("。")).toBeTruthy()

    const verb = buttons[2]
    expect(verb?.querySelector("rt")?.textContent).toBe("た")
    // Head and tail are separate underlined spans: 食べ | てみました.
    const underlined = verb?.querySelectorAll("span.relative") ?? []
    expect(underlined).toHaveLength(2)
    expect(underlined[0]?.textContent).toBe("食たべ")
    expect(underlined[1]?.textContent).toBe("てみました")

    fireEvent.click(verb as HTMLElement)
    expect(onSelectWord).toHaveBeenCalledWith(SUSHI_ANALYSIS.words[2])
  })

  it("marks the selected word with aria-pressed", () => {
    renderSentence("word", 2)
    expect(screen.getByRole("button", { pressed: true }).textContent).toContain(
      "食"
    )
  })

  it("groups words under phrase brackets", () => {
    const { container } = render(
      <JapaneseAnalyzedSentenceView
        analysis={SUSHI_ANALYSIS}
        enabledPosCategories={ALL_POS}
        onSelectWord={vi.fn()}
        selectedWordIndex={null}
        showFurigana
        showRomaji
        unit="phrase"
      />
    )
    const groups = container.querySelectorAll("span[class*='after:border-x']")
    expect(groups).toHaveLength(2)
    expect(groups[0]?.textContent).toBe("寿司すしsushiをo")
    expect(groups[1]?.textContent).toBe("食たべてみましたtabete mimashita。")
  })

  it("shows morphemes with Japanese POS tags that select their parent word", () => {
    const onSelectWord = renderSentence("morpheme")

    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(7)
    expect(buttons[4]?.textContent).toBe("み動詞")
    fireEvent.click(buttons[5] as HTMLElement)
    expect(onSelectWord).toHaveBeenCalledWith(SUSHI_ANALYSIS.words[2])
  })
})

describe("JapaneseReadingView", () => {
  beforeEach(() => {
    analyzeStub.mode = "ok"
  })

  it("switches between authentic excerpts and their source attribution", async () => {
    await i18n.changeLanguage("zh-CN")
    renderView()

    expect(screen.getByRole("heading", { name: "蜘蛛の糸" })).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "在青空文庫阅读原文" })
        .getAttribute("href")
    ).toBe(getWork("kumo-no-ito").sourceUrl)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ある日の事でございます。" })
      ).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText("选择作品"), {
      target: { value: "gon-gitsune" }
    })

    expect(screen.getByRole("heading", { name: "ごん狐" })).toBeTruthy()
    expect(
      screen.getByText("这是我小时候从村里一位叫茂平的老人那里听来的故事。")
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "在青空文庫阅读原文" })
        .getAttribute("href")
    ).toBe(getWork("gon-gitsune").sourceUrl)
  })

  it("opens the selected word panel with a look-up link", async () => {
    await i18n.changeLanguage("en-US")
    renderView()

    const word = await screen.findByRole("button", {
      name: "ある日の事でございます。"
    })
    fireEvent.click(word)

    expect(word.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("link", { name: /Look up/ }).getAttribute("href")
    ).toBe("/japanese")
  })

  it("explains when the engine is still starting and offers a retry", async () => {
    analyzeStub.mode = "unavailable"
    await i18n.changeLanguage("en-US")
    renderView()

    // The view retries once before giving up, so allow for the backoff.
    const alerts = await screen.findAllByRole("alert", {}, { timeout: 5000 })
    expect(alerts[0]?.textContent).toContain(
      "The Japanese engine is starting, try again in a moment."
    )
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(
      getWork("kumo-no-ito").sentences.length
    )
    // The in-browser engine is offered once, for the whole page.
    expect(screen.getByText("Analyze in this browser")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Download and analyze" })
    ).toBeTruthy()
  })

  it("does not offer the in-browser engine while the server analyzes", async () => {
    await i18n.changeLanguage("en-US")
    renderView()

    await screen.findByRole("button", { name: "ある日の事でございます。" })
    expect(screen.queryByText("Analyze in this browser")).toBeNull()
    expect(screen.queryByText("Analyzed in this browser")).toBeNull()
  })
})
