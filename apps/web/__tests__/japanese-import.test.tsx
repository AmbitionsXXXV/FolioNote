import type { AnalyzedText } from "@folionote/japanese"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { JapaneseArticleImport } from "../src/components/japanese/japanese-import-article"
import { JapaneseWordListImport } from "../src/components/japanese/japanese-import-wordlist"
import i18n from "../src/lib/i18n"
import {
  articleParagraphs,
  contentBaseForms,
  sliceAnalyzedText
} from "../src/lib/japanese-article"
import {
  buildLexiconRows,
  defaultListName,
  htmlToArticleText,
  meaningLanguageFor,
  splitMeanings
} from "../src/lib/japanese-wordlist-import"

const stub = vi.hoisted(() => ({
  previewMode: "ok" as "ok" | "unavailable",
  navigate: vi.fn(),
  create: vi.fn(),
  importList: vi.fn(),
  validate: vi.fn()
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search
  }: {
    children: ReactNode
    to: string
    search?: Record<string, string>
  }) => (
    <a href={search ? `${to}?${new URLSearchParams(search)}` : to}>
      {children}
    </a>
  ),
  useNavigate: () => stub.navigate
}))

const word = (
  surface: string,
  start: number,
  index: number,
  pos: AnalyzedText["words"][number]["pos"] = "noun",
  options: Partial<AnalyzedText["words"][number]> = {}
): AnalyzedText["words"][number] => ({
  index,
  start,
  end: start + surface.length,
  surface,
  morphemeIndexes: [index],
  pos,
  baseForm: surface,
  reading: null,
  ruby: null,
  romaji: null,
  isPunctuation: pos === "expression",
  tail: null,
  ...options
})

const morpheme = (
  surface: string,
  start: number,
  learnerPos: AnalyzedText["morphemes"][number]["learnerPos"] = "noun"
): AnalyzedText["morphemes"][number] => ({
  surface,
  start,
  end: start + surface.length,
  pos: "名詞",
  posDetail: [],
  conjugatedType: null,
  conjugatedForm: null,
  baseForm: surface,
  reading: null,
  pronunciation: null,
  learnerPos,
  isPunctuation: learnerPos === "expression",
  ruby: null,
  romaji: null
})

/** 駅前は広い。本屋がある。 as one chunk: two sentences, four words each side. */
const TWO_SENTENCE_TEXT = "駅前は広い。本屋がある。"
const TWO_SENTENCE_ANALYSIS: AnalyzedText = {
  text: TWO_SENTENCE_TEXT,
  engine: { id: "kuromoji-ipadic", dictVersion: "test" },
  containsJapanese: true,
  morphemes: [
    morpheme("駅前", 0),
    morpheme("は", 2, "particle"),
    morpheme("広い", 3, "adjective"),
    morpheme("。", 5, "expression"),
    morpheme("本屋", 6),
    morpheme("が", 8, "particle"),
    morpheme("ある", 9, "verb"),
    morpheme("。", 11, "expression")
  ],
  words: [
    word("駅前", 0, 0, "noun", { reading: "えきまえ" }),
    word("は", 2, 1, "particle"),
    word("広い", 3, 2, "adjective"),
    word("。", 5, 3, "expression"),
    word("本屋", 6, 4, "noun", { reading: "ほんや" }),
    word("が", 8, 5, "particle"),
    word("ある", 9, 6, "verb"),
    word("。", 11, 7, "expression")
  ],
  phrases: [
    { index: 0, start: 0, end: 3, wordIndexes: [0, 1] },
    { index: 1, start: 3, end: 6, wordIndexes: [2, 3] },
    { index: 2, start: 6, end: 9, wordIndexes: [4, 5] },
    { index: 3, start: 9, end: 12, wordIndexes: [6, 7] }
  ]
}
const PREVIEW_RESULT = {
  title: null,
  analysis: {
    chunks: [
      { start: 0, end: TWO_SENTENCE_TEXT.length, result: TWO_SENTENCE_ANALYSIS }
    ]
  },
  stats: {
    sentences: 2,
    words: 4,
    notInLists: 3,
    levels: { N5: 1, N4: 2, N3: 0, N2: 1, N1: 0, unlisted: 0 }
  },
  newWords: [
    { baseForm: "駅前", reading: "えきまえ", count: 1 },
    { baseForm: "広い", reading: "ひろい", count: 1 },
    { baseForm: "ある", reading: "ある", count: 1 }
  ]
}

const unavailable = () =>
  Object.assign(new Error("Japanese analyzer is not ready"), {
    code: "SERVICE_UNAVAILABLE"
  })

vi.mock("@/utils/orpc", () => {
  const query = (name: string, fn: (input: unknown) => unknown) => ({
    queryOptions: ({ input }: { input: unknown }) => ({
      queryKey: [name, input],
      queryFn: () => fn(input)
    }),
    queryKey: ({ input }: { input: unknown }) => [name, input],
    key: () => [name]
  })
  return {
    orpc: {
      japanese: {
        articles: {
          key: () => ["articles"],
          preview: query("preview", () =>
            stub.previewMode === "unavailable"
              ? Promise.reject(unavailable())
              : Promise.resolve(PREVIEW_RESULT)
          ),
          create: { call: stub.create },
          fetchUrl: { call: vi.fn() }
        },
        lexicons: {
          key: () => ["lexicons"],
          list: {
            queryOptions: () => ({
              queryKey: ["lexicons", "list"],
              queryFn: () =>
                Promise.resolve([
                  {
                    id: "lex1",
                    name: "红宝书",
                    level: "N2",
                    kind: "book",
                    meaningLanguage: "zh",
                    entryCount: 1
                  }
                ])
            })
          },
          lookup: query("lookup", (input) => {
            const { baseForms } = input as { baseForms: string[] }
            return Promise.resolve(
              baseForms.includes("本屋")
                ? [
                    {
                      baseForm: "本屋",
                      lexiconId: "lex1",
                      lexiconName: "红宝书",
                      unit: "1",
                      meanings: ["书店"]
                    }
                  ]
                : []
            )
          }),
          validate: query("validate", (input) => stub.validate(input)),
          import: { call: stub.importList }
        }
      }
    }
  }
})

const renderWithProviders = (node: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
    </QueryClientProvider>
  )
}

describe("buildLexiconRows", () => {
  it("maps column roles to import rows and splits meanings", () => {
    const rows = buildLexiconRows(
      ["headword", "reading", "meaning", "unit"],
      [
        ["商店街", "しょうてんがい", "商业街；商店街", "1"],
        ["賑わう", "", "热闹 / 繁荣、兴旺", "2"],
        ["", "", "", ""]
      ]
    )
    expect(rows).toEqual([
      {
        headword: "商店街",
        reading: "しょうてんがい",
        meanings: ["商业街", "商店街"],
        pos: undefined,
        unit: "1"
      },
      {
        headword: "賑わう",
        reading: undefined,
        meanings: ["热闹", "繁荣", "兴旺"],
        pos: undefined,
        unit: "2"
      },
      // Kept so validation indexes line up with the table; the server flags it.
      {
        headword: "",
        reading: undefined,
        meanings: undefined,
        pos: undefined,
        unit: undefined
      }
    ])
  })

  it("concatenates several meaning columns and ignores the rest", () => {
    const [row] = buildLexiconRows(
      ["ignore", "headword", "meaning", "meaning", "pos"],
      [["7", "食べる", "to eat", "to eat; to have", "v1"]]
    )
    expect(row).toEqual({
      headword: "食べる",
      reading: undefined,
      meanings: ["to eat", "to have"],
      pos: "v1",
      unit: undefined
    })
  })

  it("exposes the small helpers the import page relies on", () => {
    expect(splitMeanings(" a ；b;c、d/e ")).toEqual(["a", "b", "c", "d", "e"])
    expect(defaultListName("红宝书 N2.csv")).toBe("红宝书 N2")
    expect(meaningLanguageFor("zh-CN")).toBe("zh")
    expect(meaningLanguageFor("ja")).toBe("ja")
    expect(meaningLanguageFor("en-US")).toBe("en")
    expect(
      htmlToArticleText(
        "<html><head><title>見出し</title><style>p{}</style></head><body><p>一行目。</p><p>二行目。</p></body></html>"
      )
    ).toEqual({ title: "見出し", text: "一行目。\n\n二行目。" })
  })
})

describe("article analysis slicing", () => {
  it("re-indexes a chunk down to one sentence", () => {
    const second = sliceAnalyzedText(TWO_SENTENCE_ANALYSIS, 6, 12)
    expect(second.text).toBe("本屋がある。")
    expect(second.words.map((entry) => entry.surface)).toEqual([
      "本屋",
      "が",
      "ある",
      "。"
    ])
    expect(second.words.map((entry) => entry.index)).toEqual([0, 1, 2, 3])
    expect(second.words[0]?.start).toBe(0)
    expect(second.words[0]?.morphemeIndexes).toEqual([0])
    expect(second.morphemes).toHaveLength(4)
    expect(second.phrases.map((phrase) => phrase.wordIndexes)).toEqual([
      [0, 1],
      [2, 3]
    ])
  })

  it("groups sentences by paragraph and keeps unanalyzed text readable", () => {
    const paragraphs = articleParagraphs(TWO_SENTENCE_TEXT, {
      chunks: [
        {
          start: 0,
          end: TWO_SENTENCE_TEXT.length,
          result: TWO_SENTENCE_ANALYSIS
        }
      ]
    })
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]?.sentences.map((sentence) => sentence.text)).toEqual([
      "駅前は広い。",
      "本屋がある。"
    ])
    expect(paragraphs[0]?.sentences[1]?.analysis?.words[0]?.surface).toBe(
      "本屋"
    )

    const plain = articleParagraphs("一段目。\n\n二段目。", null)
    expect(plain.map((paragraph) => paragraph.sentences.length)).toEqual([1, 1])
    expect(plain[1]?.sentences[0]?.analysis).toBeNull()

    expect(contentBaseForms([TWO_SENTENCE_ANALYSIS])).toEqual([
      "ある",
      "広い",
      "本屋",
      "駅前"
    ])
  })
})

describe("JapaneseArticleImport", () => {
  beforeEach(async () => {
    stub.previewMode = "ok"
    stub.navigate.mockReset()
    stub.create.mockReset()
    await i18n.changeLanguage("en-US")
  })

  it("previews pasted text with stats, shaded new words and list tags", async () => {
    renderWithProviders(<JapaneseArticleImport />)
    expect(screen.getByRole("status").textContent).toBe("Paste text to preview")

    fireEvent.change(screen.getByLabelText("Japanese text"), {
      target: { value: TWO_SENTENCE_TEXT }
    })

    await waitFor(
      () => {
        expect(screen.getByRole("status").textContent).toBe("Preview ready")
      },
      { timeout: 3000 }
    )
    expect(screen.getByText(/Contains data from OpenJLPT/)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /CC BY-SA/ }).getAttribute("href")
    ).toContain("creativecommons.org")
    // Stat tiles: sentences / words / not in your lists.
    expect(
      screen.getAllByRole("definition").map((node) => node.textContent)
    ).toEqual(["2", "4", "3"])
    expect(
      screen.getByRole("img", { name: /N5: 1 words, N4: 2 words/ })
    ).toBeTruthy()
    // Only the first sentence is rendered as word units.
    const units = screen.getAllByRole("button", { pressed: false })
    expect(units.map((unit) => unit.textContent)).toEqual([
      "駅前",
      "は",
      "広い"
    ])
    expect(units[0]?.dataset.newWord).toBe("true")
    expect(units[1]?.dataset.newWord).toBeUndefined()
    expect(
      screen.getByRole("link", { name: /駅前/ }).getAttribute("href")
    ).toBe("/japanese?q=%E9%A7%85%E5%89%8D")
  })

  it("decodes a Shift_JIS HTML file and removes ruby annotations", async () => {
    renderWithProviders(<JapaneseArticleImport />)
    fireEvent.click(screen.getByRole("radio", { name: "File" }))
    const prefix = new TextEncoder().encode(
      '<meta charset="shift_jis"><title>Title &amp; name</title><p><b>'
    )
    const suffix = new TextEncoder().encode(
      "</b><ruby>A<rt>reading</rt><rp>(</rp></ruby></p>"
    )
    const bytes = new Uint8Array([
      ...prefix,
      0x93,
      0xfa,
      0x96,
      0x7b,
      0x8c,
      0xea,
      ...suffix
    ])
    const file = new File([bytes], "article.html", { type: "text/html" })
    fireEvent.change(screen.getByLabelText("Text file"), {
      target: { files: [file] }
    })
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Japanese text") as HTMLTextAreaElement).value
      ).toBe("日本語A")
    )
    expect(screen.getByDisplayValue("Title & name")).toBeTruthy()
  })

  it("keeps saving possible when the engine is unavailable", async () => {
    stub.previewMode = "unavailable"
    stub.create.mockResolvedValue({ id: "art1" })
    renderWithProviders(<JapaneseArticleImport />)

    fireEvent.change(screen.getByLabelText("Japanese text"), {
      target: { value: TWO_SENTENCE_TEXT }
    })
    await screen.findByText(
      "Preview needs the Japanese engine; you can still save and it will be analyzed later.",
      {},
      { timeout: 3000 }
    )
    const submit = screen.getByRole("button", { name: "Add to library" })
    expect(submit.hasAttribute("disabled")).toBe(false)

    fireEvent.click(submit)
    await waitFor(() => {
      expect(stub.create).toHaveBeenCalledWith({
        title: "駅前は広い",
        text: TWO_SENTENCE_TEXT,
        sourceType: "paste",
        sourceUrl: undefined
      })
    })
    expect(stub.navigate).toHaveBeenCalledWith({
      to: "/japanese/read/$articleId",
      params: { articleId: "art1" }
    })
  })
})

describe("JapaneseWordListImport", () => {
  const CSV = [
    "单词,读音,释义,单元",
    "商店街,しょうてんがい,商业街；商店街,1",
    "賑わう,,热闹；繁荣,2",
    "商店街,しょうてんがい,商业街,3",
    ",,空行,4"
  ].join("\n")

  const pickFile = (content: string, name = "红宝书 N2.csv") => {
    const input = screen.getByLabelText("Drop a word list here")
    const file = new File([content], name, { type: "text/csv" })
    fireEvent.change(input, { target: { files: [file] } })
  }

  beforeEach(async () => {
    stub.navigate.mockReset()
    stub.importList.mockReset()
    stub.validate.mockReset()
    stub.validate.mockImplementation(({ rows }: { rows: unknown[] }) =>
      Promise.resolve({
        summary: {
          total: rows.length,
          ready: 2,
          readingsFilled: 1,
          duplicatesMerged: 1,
          errors: 1
        },
        rows: [
          { index: 0, status: "ready", reading: "しょうてんがい" },
          { index: 1, status: "reading-filled", reading: "にぎわう" },
          { index: 2, status: "duplicate", reading: "しょうてんがい" },
          {
            index: 3,
            status: "error",
            reading: null,
            message: "Headword is empty"
          }
        ]
      })
    )
    await i18n.changeLanguage("en-US")
  })

  it("decodes a Shift_JIS CSV before parsing cells", async () => {
    renderWithProviders(<JapaneseWordListImport />)
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("word,meaning\n"),
      0x93,
      0xfa,
      0x96,
      0x7b,
      0x8c,
      0xea,
      ...new TextEncoder().encode(",Japanese")
    ])
    const file = new File([bytes], "words.csv", {
      type: "text/csv; charset=shift_jis"
    })
    fireEvent.change(screen.getByLabelText("Drop a word list here"), {
      target: { files: [file] }
    })
    const cells = await screen.findAllByText("日本語")
    expect(cells.length).toBeGreaterThan(0)
  })

  it("parses the file in the browser, guesses roles and shows check statuses", async () => {
    renderWithProviders(<JapaneseWordListImport />)
    pickFile(CSV)

    await screen.findByText("First 4 rows")
    expect(screen.getByText(/CSV · 4 rows/)).toBeTruthy()
    expect(screen.getByText(/Header row detected/)).toBeTruthy()
    expect(
      (screen.getByLabelText("Role for column 读音") as HTMLSelectElement).value
    ).toBe("reading")
    expect((screen.getByLabelText("List name") as HTMLInputElement).value).toBe(
      "红宝书 N2"
    )

    await waitFor(
      () => {
        expect(screen.getByText("Reading filled by engine")).toBeTruthy()
      },
      { timeout: 3000 }
    )
    expect(screen.getByText("にぎわう")).toBeTruthy()
    expect(screen.getByText("Duplicate, merged")).toBeTruthy()
    expect(screen.getByText("Headword is empty")).toBeTruthy()
    expect(stub.validate).toHaveBeenCalledWith({
      rows: [
        {
          headword: "商店街",
          reading: "しょうてんがい",
          meanings: ["商业街", "商店街"],
          pos: undefined,
          unit: "1"
        },
        {
          headword: "賑わう",
          reading: undefined,
          meanings: ["热闹", "繁荣"],
          pos: undefined,
          unit: "2"
        },
        {
          headword: "商店街",
          reading: "しょうてんがい",
          meanings: ["商业街"],
          pos: undefined,
          unit: "3"
        },
        {
          headword: "",
          reading: undefined,
          meanings: ["空行"],
          pos: undefined,
          unit: "4"
        }
      ]
    })

    // "Needs a look" hides the ready row (the only one with both meanings).
    fireEvent.click(screen.getByRole("radio", { name: "Needs a look (3)" }))
    expect(screen.queryByText("商业街；商店街")).toBeNull()
    expect(screen.getAllByRole("row")).toHaveLength(4)
  })

  it("requires exactly one Word column and imports with the chosen settings", async () => {
    stub.importList.mockResolvedValue({ id: "lex9", summary: {} })
    renderWithProviders(<JapaneseWordListImport />)
    pickFile(CSV)
    await screen.findByText("First 4 rows")
    const submit = await screen.findByRole(
      "button",
      { name: "Import 2 rows" },
      { timeout: 3000 }
    )

    fireEvent.change(screen.getByLabelText("Role for column 读音"), {
      target: { value: "headword" }
    })
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose exactly one Word column."
    )
    expect(submit.hasAttribute("disabled")).toBe(true)

    fireEvent.change(screen.getByLabelText("Role for column 读音"), {
      target: { value: "reading" }
    })
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull()
      expect(submit.hasAttribute("disabled")).toBe(false)
    })

    fireEvent.click(screen.getByRole("radio", { name: "Deck" }))
    fireEvent.change(screen.getByLabelText("Level tag"), {
      target: { value: "N2" }
    })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(stub.importList).toHaveBeenCalledTimes(1)
    })
    expect(stub.importList.mock.calls[0]?.[0]).toMatchObject({
      name: "红宝书 N2",
      kind: "deck",
      level: "N2",
      meaningLanguage: "en"
    })
    expect(stub.navigate).toHaveBeenCalledWith({
      to: "/japanese/lists/$lexiconId",
      params: { lexiconId: "lex9" }
    })
  })

  it("shows a name conflict inline", async () => {
    stub.importList.mockRejectedValue(
      Object.assign(new Error("exists"), { code: "CONFLICT" })
    )
    renderWithProviders(<JapaneseWordListImport />)
    pickFile(CSV)
    const submit = await screen.findByRole(
      "button",
      { name: "Import 2 rows" },
      { timeout: 3000 }
    )
    fireEvent.click(submit)
    await screen.findByText("You already have a list with this name.")
    expect(stub.navigate).not.toHaveBeenCalled()
  })
})

it("imports ruby base text without readings or inline sentence breaks", () => {
  expect(
    htmlToArticleText(
      "<p>今日は<a>東京</a>に行った</p><p><ruby><rb>漢字</rb><rp>（</rp><rt>かんじ</rt><rp>）</rp></ruby>を<b>勉強</b>しました</p>"
    ).text
  ).toBe("今日は東京に行った\n\n漢字を勉強しました")
})
