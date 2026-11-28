import { describe, expect, it } from "vite-plus/test"

import {
  findActiveCueIndex,
  formatCueTime,
  parseSubtitles
} from "../src/subtitles"

describe("parseSubtitles", () => {
  it("parses SRT with CRLF, a BOM, multi-line text and markup", () => {
    const srt =
      "\uFEFF1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>こんにちは</i>\r\n世界\r\n\r\n" +
      "2\r\n00:00:03,000 --> 00:00:04,000\r\n{\\an8}Tom &amp; Jerry\r\n"
    expect(parseSubtitles(srt)).toEqual([
      { endMs: 2500, index: 0, startMs: 1000, text: "こんにちは\n世界" },
      { endMs: 4000, index: 1, startMs: 3000, text: "Tom & Jerry" }
    ])
  })

  it("parses WebVTT with header, NOTE, identifiers, cue settings and karaoke tags", () => {
    const vtt = [
      "WEBVTT - sample",
      "",
      "NOTE this block is ignored",
      "",
      "intro",
      "00:05.250 --> 00:07.000 align:start position:10%",
      "<v Speaker>今日は<00:00:06.000><c>いい天気</c>",
      "",
      "01:00:00.000 --> 01:00:01.5",
      "最後"
    ].join("\n")
    expect(parseSubtitles(vtt)).toEqual([
      { endMs: 7000, index: 0, startMs: 5250, text: "今日はいい天気" },
      { endMs: 3_601_500, index: 1, startMs: 3_600_000, text: "最後" }
    ])
  })

  it("sorts cues by start and drops empty or zero-length cues", () => {
    const srt = [
      "1",
      "00:00:05,000 --> 00:00:06,000",
      "second",
      "",
      "2",
      "00:00:01,000 --> 00:00:02,000",
      "first",
      "",
      "3",
      "00:00:03,000 --> 00:00:03,000",
      "zero length",
      "",
      "4",
      "00:00:04,000 --> 00:00:05,000",
      "<b></b>"
    ].join("\n")
    expect(parseSubtitles(srt).map((cue) => [cue.index, cue.text])).toEqual([
      [0, "first"],
      [1, "second"]
    ])
  })

  it("returns no cues for text without timing lines", () => {
    expect(parseSubtitles("just some pasted lyrics\nno timings")).toEqual([])
  })
})

describe("findActiveCueIndex", () => {
  const cues = parseSubtitles(
    [
      "00:00:01.000 --> 00:00:02.000",
      "a",
      "",
      "00:00:04.000 --> 00:00:05.000",
      "b",
      "",
      "00:00:05.000 --> 00:00:06.000",
      "c"
    ].join("\n")
  )

  it("is -1 before the first cue", () => {
    expect(findActiveCueIndex(cues, 999)).toBe(-1)
    expect(findActiveCueIndex([], 10_000)).toBe(-1)
  })

  it("holds the previous cue through a gap and switches exactly at a start", () => {
    expect(findActiveCueIndex(cues, 1000)).toBe(0)
    expect(findActiveCueIndex(cues, 3000)).toBe(0)
    expect(findActiveCueIndex(cues, 4000)).toBe(1)
    expect(findActiveCueIndex(cues, 5000)).toBe(2)
    expect(findActiveCueIndex(cues, 99_000)).toBe(2)
  })
})

describe("formatCueTime", () => {
  it("formats minutes and hours", () => {
    expect(formatCueTime(0)).toBe("0:00")
    expect(formatCueTime(65_900)).toBe("1:05")
    expect(formatCueTime(3_725_000)).toBe("1:02:05")
  })
})
