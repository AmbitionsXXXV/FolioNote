import { describe, expect, it } from "vite-plus/test"

import { splitJapaneseSentences } from "../src/components/editor/japanese-paste-offer"

describe("splitJapaneseSentences", () => {
  it("splits on sentence-ending punctuation and keeps it", () => {
    expect(
      splitJapaneseSentences(
        "在宅勤務が増えた。通勤しなくて済むようになった！本当？"
      )
    ).toEqual([
      "在宅勤務が増えた。",
      "通勤しなくて済むようになった！",
      "本当？"
    ])
  })

  it("treats line breaks as boundaries and drops blank lines", () => {
    expect(
      splitJapaneseSentences(
        "満員電車に揺られていた人\n\n  仕事ができてしまう  "
      )
    ).toEqual(["満員電車に揺られていた人", "仕事ができてしまう"])
  })
})
