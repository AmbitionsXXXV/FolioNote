import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import {
  fetchYouTubeVideoInfo,
  parseIsoDurationSeconds,
  YouTubeVideoNotFoundError
} from "../../src/connectors/youtube"

const ID = "dQw4w9WgXcQ"

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("parseIsoDurationSeconds", () => {
  it("reads hours, minutes, seconds and days", () => {
    expect(parseIsoDurationSeconds("PT3M33S")).toBe(213)
    expect(parseIsoDurationSeconds("PT1H2M3S")).toBe(3723)
    expect(parseIsoDurationSeconds("PT45S")).toBe(45)
    expect(parseIsoDurationSeconds("P1DT1S")).toBe(86_401)
  })

  it("is null for live streams and garbage", () => {
    expect(parseIsoDurationSeconds("P0D")).toBeNull()
    expect(parseIsoDurationSeconds("PT")).toBeNull()
    expect(parseIsoDurationSeconds("3:33")).toBeNull()
  })
})

describe("fetchYouTubeVideoInfo", () => {
  it("uses oEmbed when no API key is configured", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "")
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        author_name: "Channel",
        thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg",
        title: "Title"
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchYouTubeVideoInfo(ID)).resolves.toEqual({
      channelTitle: "Channel",
      durationSeconds: null,
      embeddable: null,
      source: "oembed",
      thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
      title: "Title",
      videoId: ID
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/oembed?")
  })

  it("uses the Data API when a key is configured", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          items: [
            {
              contentDetails: { duration: "PT3M33S" },
              snippet: {
                channelTitle: "Channel",
                thumbnails: {
                  high: { url: "https://i.ytimg.com/high.jpg" },
                  maxres: { url: "https://i.ytimg.com/maxres.jpg" }
                },
                title: "Title"
              },
              status: { embeddable: false }
            }
          ]
        })
      )
    )

    await expect(fetchYouTubeVideoInfo(ID)).resolves.toMatchObject({
      durationSeconds: 213,
      embeddable: false,
      source: "data_api",
      thumbnailUrl: "https://i.ytimg.com/maxres.jpg"
    })
  })

  it("reports a missing video instead of falling back", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key")
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchYouTubeVideoInfo(ID)).rejects.toBeInstanceOf(
      YouTubeVideoNotFoundError
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to oEmbed when the Data API errors (e.g. quota)", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: {} }, 403))
      .mockResolvedValueOnce(jsonResponse({ title: "Title" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchYouTubeVideoInfo(ID)).resolves.toMatchObject({
      source: "oembed",
      title: "Title"
    })
  })

  it("treats an oEmbed 4xx as not found", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 }))
    )
    await expect(fetchYouTubeVideoInfo(ID)).rejects.toBeInstanceOf(
      YouTubeVideoNotFoundError
    )
  })
})
