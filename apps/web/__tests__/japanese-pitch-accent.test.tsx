import { describe, expect, it } from "vite-plus/test"

import {
  circledAccent,
  pitchPattern,
  splitMorae
} from "../src/lib/japanese/pitch-accent"

const shape = (reading: string, accent: number) =>
  pitchPattern(reading, accent)
    .map((mora) => `${mora.high ? "H" : "L"}${mora.drop ? "↓" : ""}`)
    .join("")

describe("pitch accent", () => {
  it("fuses small kana into the mora before them", () => {
    expect(splitMorae("きょうしつ")).toEqual(["きょ", "う", "し", "つ"])
    expect(splitMorae("ファン")).toEqual(["ファ", "ン"])
  })

  it("draws flat, initial-drop and mid-drop patterns", () => {
    expect(shape("ことし", 0)).toBe("LHH")
    expect(shape("てんき", 1)).toBe("H↓LL")
    expect(shape("おとうさん", 2)).toBe("LH↓LLL")
    expect(shape("おとうと", 4)).toBe("LHHH↓")
  })

  it("prints accent numbers the way dictionaries do", () => {
    expect(circledAccent(0)).toBe("⓪")
    expect(circledAccent(1)).toBe("①")
    expect(circledAccent(3)).toBe("③")
  })
})
