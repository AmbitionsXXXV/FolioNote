import { describe, expect, it } from "vite-plus/test"

import { parseYouTubeVideoId } from "../src/youtube"

const ID = "dQw4w9WgXcQ"

describe("parseYouTubeVideoId", () => {
  it.each([
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?feature=share&v=${ID}&t=42s`,
    `m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&list=RD`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}?start=10`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  https://youtu.be/${ID}  `
  ])("reads the id from %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBe(ID)
  })

  it.each([
    "",
    "not a link",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@channel",
    `https://evil-youtube.com/watch?v=${ID}`,
    `https://youtube.com.evil.test/watch?v=${ID}`,
    "https://www.youtube.com/watch?v=short",
    `https://vimeo.com/${ID}`
  ])("rejects %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull()
  })
})
