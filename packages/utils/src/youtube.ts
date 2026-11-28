const VIDEO_ID_PATTERN = /^[\w-]{11}$/
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com"
])
const SHORT_LINK_HOST = "youtu.be"
// Path forms that carry the id as the next segment: /shorts/ID, /embed/ID, /live/ID, /v/ID.
const ID_PATH_PREFIXES = new Set(["shorts", "embed", "live", "v"])

/**
 * Extracts the 11-character video id from a pasted YouTube link (or a bare id).
 * Returns null for anything that is not a recognizable single-video link, so
 * playlists, channels and look-alike hosts are rejected instead of guessed at.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed

  let url: URL
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split("/").filter(Boolean)
  let candidate: string | null | undefined = null

  if (host === SHORT_LINK_HOST) {
    candidate = segments[0]
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [first, second] = segments
    if (first === "watch") {
      candidate = url.searchParams.get("v")
    } else if (first && ID_PATH_PREFIXES.has(first)) {
      candidate = second
    }
  }

  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null
}
