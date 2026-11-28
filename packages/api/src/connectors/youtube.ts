/**
 * Video metadata for a pasted YouTube link.
 *
 * With `YOUTUBE_API_KEY` set, this uses the Data API (`videos.list`), which also
 * returns duration and whether the owner allows embedding. Without it, it falls
 * back to oEmbed, which needs no key but has no duration. Neither path touches
 * captions or media: captions stay user-supplied (see the listening roadmap).
 */

import { createLogger } from "@folionote/log"

const log = createLogger({ prefix: "api:youtube" })
const DATA_API_URL = "https://www.googleapis.com/youtube/v3/videos"
const OEMBED_URL = "https://www.youtube.com/oembed"
const REQUEST_TIMEOUT_MS = 8000
// ISO 8601 durations from the Data API look like PT1H2M3S (days only on very long live streams).
const ISO_DURATION_PATTERN =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86_400

export interface YouTubeVideoInfo {
  videoId: string
  title: string
  channelTitle: string | null
  thumbnailUrl: string | null
  /** Null when only oEmbed was available, or for an ongoing live stream. */
  durationSeconds: number | null
  /** Null when unknown (oEmbed doesn't say). */
  embeddable: boolean | null
  source: "data_api" | "oembed"
}

export class YouTubeVideoNotFoundError extends Error {
  constructor(videoId: string) {
    super(`YouTube video ${videoId} was not found or is private`)
    this.name = "YouTubeVideoNotFoundError"
  }
}

export function parseIsoDurationSeconds(value: string): number | null {
  const match = ISO_DURATION_PATTERN.exec(value)
  if (!match || value === "P" || value === "PT") return null
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match
  const total =
    Number(days) * SECONDS_PER_DAY +
    Number(hours) * SECONDS_PER_HOUR +
    Number(minutes) * SECONDS_PER_MINUTE +
    Number(seconds)
  // Live streams report P0D while they're on air.
  return total > 0 ? Math.round(total) : null
}

interface DataApiThumbnail {
  url?: string
}

interface DataApiResponse {
  items?: {
    snippet?: {
      title?: string
      channelTitle?: string
      thumbnails?: Record<string, DataApiThumbnail | undefined>
    }
    contentDetails?: { duration?: string }
    status?: { embeddable?: boolean }
  }[]
}

const THUMBNAIL_PREFERENCE = ["maxres", "standard", "high", "medium", "default"]

async function fetchFromDataApi(
  videoId: string,
  apiKey: string
): Promise<YouTubeVideoInfo> {
  const url = new URL(DATA_API_URL)
  url.searchParams.set("part", "snippet,contentDetails,status")
  url.searchParams.set("id", videoId)
  url.searchParams.set("key", apiKey)
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    // Don't echo the URL: it carries the key.
    throw new Error(`YouTube Data API responded ${response.status}`)
  }
  const body = (await response.json()) as DataApiResponse
  const item = body.items?.[0]
  if (!item?.snippet?.title) throw new YouTubeVideoNotFoundError(videoId)

  const thumbnails = item.snippet.thumbnails ?? {}
  const thumbnailUrl =
    THUMBNAIL_PREFERENCE.map((size) => thumbnails[size]?.url).find(Boolean) ??
    null
  const duration = item.contentDetails?.duration
  return {
    videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle ?? null,
    thumbnailUrl,
    durationSeconds: duration ? parseIsoDurationSeconds(duration) : null,
    embeddable: item.status?.embeddable ?? null,
    source: "data_api"
  }
}

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

async function fetchFromOEmbed(videoId: string): Promise<YouTubeVideoInfo> {
  const url = new URL(OEMBED_URL)
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`)
  url.searchParams.set("format", "json")
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  // oEmbed answers 400/401/403/404 for removed, private or unknown videos.
  if (response.status >= 400 && response.status < 500) {
    throw new YouTubeVideoNotFoundError(videoId)
  }
  if (!response.ok) {
    throw new Error(`YouTube oEmbed responded ${response.status}`)
  }
  const body = (await response.json()) as OEmbedResponse
  if (!body.title) throw new YouTubeVideoNotFoundError(videoId)
  return {
    videoId,
    title: body.title,
    channelTitle: body.author_name ?? null,
    thumbnailUrl: body.thumbnail_url ?? null,
    durationSeconds: null,
    embeddable: null,
    source: "oembed"
  }
}

export async function fetchYouTubeVideoInfo(
  videoId: string
): Promise<YouTubeVideoInfo> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim()
  if (!apiKey) return fetchFromOEmbed(videoId)
  try {
    return await fetchFromDataApi(videoId, apiKey)
  } catch (error) {
    if (error instanceof YouTubeVideoNotFoundError) throw error
    // Quota exhausted, key revoked or Google down: oEmbed still gives title + channel.
    log.warn("Data API failed, falling back to oEmbed:", error)
    return fetchFromOEmbed(videoId)
  }
}
