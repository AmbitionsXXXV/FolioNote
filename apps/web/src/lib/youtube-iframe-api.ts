/**
 * Minimal typings + loader for the official YouTube IFrame Player API.
 * https://developers.google.com/youtube/iframe_api_reference
 *
 * Only the members FolioNote uses are typed; the API is loaded from YouTube at
 * runtime (it cannot be bundled), and the player stays the official embed so
 * YouTube's branding, controls and ads remain intact.
 */

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
} as const

export interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  setPlaybackRate: (rate: number) => void
  getAvailablePlaybackRates: () => number[]
  getVideoData?: () => { title?: string; author?: string }
  destroy: () => void
}

interface YouTubePlayerEvent {
  target: YouTubePlayer
  data: number
}

export interface YouTubePlayerOptions {
  videoId: string
  host?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void
    onStateChange?: (event: YouTubePlayerEvent) => void
    onPlaybackRateChange?: (event: YouTubePlayerEvent) => void
    onError?: (event: YouTubePlayerEvent) => void
  }
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api"
const LOAD_TIMEOUT_MS = 15_000
let apiPromise: Promise<YouTubeNamespace> | null = null

/** Loads the IFrame API once per page; later callers share the same promise. */
export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      apiPromise = null
      reject(new Error("YouTube IFrame API did not load"))
    }, LOAD_TIMEOUT_MS)
    // The API calls this global when ready; keep any handler another script set.
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      window.clearTimeout(timeout)
      if (window.YT?.Player) {
        resolve(window.YT)
      } else {
        apiPromise = null
        reject(new Error("YouTube IFrame API loaded without a Player"))
      }
    }
    const script = document.createElement("script")
    script.src = IFRAME_API_SRC
    script.async = true
    script.addEventListener("error", () => {
      window.clearTimeout(timeout)
      apiPromise = null
      script.remove()
      reject(new Error("YouTube IFrame API failed to load"))
    })
    document.head.append(script)
  })
  return apiPromise
}

/**
 * YouTube player error codes → the reason we show.
 * 2 = bad id, 5 = HTML5 error, 100 = removed/private, 101/150 = embedding disabled by the owner.
 */
export type YouTubePlayerErrorReason =
  | "invalid"
  | "playback"
  | "unavailable"
  | "embedDisabled"

export function youTubeErrorReason(code: number): YouTubePlayerErrorReason {
  if (code === 2) return "invalid"
  if (code === 100) return "unavailable"
  if (code === 101 || code === 150) return "embedDisabled"
  return "playback"
}
