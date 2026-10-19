import { describe, expect, it } from "vite-plus/test"

import { decodeJapaneseBytes, htmlToJapaneseText } from "../src"

const encode = (text: string) => new TextEncoder().encode(text)
const sjis = new Uint8Array([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]) // 日本語

describe("htmlToJapaneseText", () => {
  it.each([
    ["今日は<a>東京</a>に行った", "今日は東京に行った"],
    ["<b>勉強</b>しました", "勉強しました"],
    ["<ruby><rb>漢字</rb><rp>（</rp><rt>かんじ</rt><rp>）</rp></ruby>", "漢字"],
    ["<p>一</p><div>二<br>三</div>", "一\n\n二\n三"],
    ["&copy; &mdash; &#26085;&#x672c; &amp; &lt;b&gt;", "© — 日本 & <b>"],
    [
      '<span title="a > b">文</span><template><div>隠す</div></template>末',
      "文末"
    ],
    [
      "文<script>bad()</script><style>bad</style><noscript>bad</noscript>末",
      "文末"
    ]
  ])("converts %s", (html, text) => {
    expect(htmlToJapaneseText(html).text).toBe(text)
  })
  it("extracts a decoded title before discarding the head, falling back to the first h1", () => {
    expect(
      htmlToJapaneseText(
        "<head><title>題 &amp; 名</title></head><h1>別題</h1><p>本文</p>"
      )
    ).toEqual({ title: "題 & 名", text: "別題\n\n本文" })
    expect(htmlToJapaneseText("<h1><b>見出し</b></h1><h1>次</h1>").title).toBe(
      "見出し"
    )
    expect(htmlToJapaneseText("本文").title).toBeNull()
  })
})

describe("decodeJapaneseBytes", () => {
  it("uses the header charset before HTML declarations", () => {
    const bytes = new Uint8Array([...encode('<meta charset="utf-8">'), ...sjis])
    expect(
      decodeJapaneseBytes(bytes, 'text/html; charset="Shift_JIS"')
    ).toContain("日本語")
  })
  it.each([
    '<meta charset="shift_jis">',
    '<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">'
  ])("sniffs %s", (meta) => {
    expect(
      decodeJapaneseBytes(new Uint8Array([...encode(meta), ...sjis]))
    ).toContain("日本語")
  })
  it("supports EUC-JP and ISO-2022-JP", () => {
    expect(
      decodeJapaneseBytes(
        new Uint8Array([0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec]),
        "text/plain; charset=euc-jp"
      )
    ).toBe("日本語")
    expect(
      decodeJapaneseBytes(
        new Uint8Array([27, 36, 66, 70, 124, 75, 92, 56, 108, 27, 40, 66]),
        "text/plain; charset=iso-2022-jp"
      )
    ).toBe("日本語")
  })
  it("uses BOMs, defaults to UTF-8, and tolerates unknown labels", () => {
    expect(
      decodeJapaneseBytes(new Uint8Array([0xff, 0xfe, 0xe5, 0x65, 0x2c, 0x67]))
    ).toBe("日本")
    expect(
      decodeJapaneseBytes(new Uint8Array([0xfe, 0xff, 0x65, 0xe5, 0x67, 0x2c]))
    ).toBe("日本")
    expect(decodeJapaneseBytes(encode("日本語").buffer)).toBe("日本語")
    expect(
      decodeJapaneseBytes(encode("日本語"), "text/plain; charset=unknown-label")
    ).toBe("日本語")
    expect(
      decodeJapaneseBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...encode("日本")]))
    ).toBe("日本")
  })
  it("limits meta sniffing to the first 2 KB", () => {
    const source = `${" ".repeat(2048)}<meta charset="shift_jis">日本語`
    expect(decodeJapaneseBytes(encode(source))).toBe(source)
  })
})
