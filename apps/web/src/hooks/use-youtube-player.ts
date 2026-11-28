import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  YouTubePlayer,
  YouTubePlayerErrorReason
} from "@/lib/youtube-iframe-api"
import {
  loadYouTubeIframeApi,
  YT_PLAYER_STATE,
  youTubeErrorReason
} from "@/lib/youtube-iframe-api"

const MS_PER_SECOND = 1000
// The iframe reports its time over postMessage a few times a second. Between
// reports we extrapolate with the wall clock, but never further than this, so a
// stalled report (buffering we haven't been told about) can't run ahead.
const MAX_EXTRAPOLATION_MS = 750

export type YouTubePlayerStatus = "loading" | "ready" | "error"

export interface YouTubePlayerControls {
  status: YouTubePlayerStatus
  errorReason: YouTubePlayerErrorReason | "apiUnavailable" | null
  isPlaying: boolean
  playbackRate: number
  availableRates: number[]
  title: string | null
  /** Smoothed playback position; cheap enough to call every animation frame. */
  getCurrentTimeMs: () => number
  seekToMs: (timeMs: number) => void
  play: () => void
  pause: () => void
  setPlaybackRate: (rate: number) => void
}

const DEFAULT_RATES = [0.5, 0.75, 1, 1.25, 1.5]

/**
 * Mounts the official YouTube embed into `hostRef` and exposes the few controls
 * the listening view needs. The player is rebuilt when `videoId` changes.
 */
export function useYouTubePlayer(
  hostRef: RefObject<HTMLDivElement | null>,
  videoId: string
): YouTubePlayerControls {
  const playerRef = useRef<YouTubePlayer | null>(null)
  const isPlayingRef = useRef(false)
  const rateRef = useRef(1)
  // Last time the iframe actually reported, and when we saw it change.
  const reportedRef = useRef({ seconds: 0, atMs: 0 })
  const [status, setStatus] = useState<YouTubePlayerStatus>("loading")
  const [errorReason, setErrorReason] =
    useState<YouTubePlayerControls["errorReason"]>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setRate] = useState(1)
  const [availableRates, setAvailableRates] = useState(DEFAULT_RATES)
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let isCancelled = false
    setStatus("loading")
    setErrorReason(null)
    setIsPlaying(false)
    setTitle(null)
    isPlayingRef.current = false
    reportedRef.current = { seconds: 0, atMs: performance.now() }

    // YT.Player replaces the element it is given, so hand it a child we own
    // rather than the React-managed host.
    const mount = document.createElement("div")
    host.replaceChildren(mount)

    loadYouTubeIframeApi()
      .then((YT) => {
        if (isCancelled) return
        playerRef.current = new YT.Player(mount, {
          videoId,
          // Privacy-enhanced host: no cookies until the viewer presses play.
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: ({ target }) => {
              if (isCancelled) return
              setStatus("ready")
              setTitle(target.getVideoData?.().title ?? null)
              const rates = target.getAvailablePlaybackRates()
              if (rates.length > 0) setAvailableRates(rates)
            },
            onStateChange: ({ target, data }) => {
              const playing = data === YT_PLAYER_STATE.PLAYING
              isPlayingRef.current = playing
              setIsPlaying(playing)
              reportedRef.current = {
                seconds: target.getCurrentTime(),
                atMs: performance.now()
              }
              // Some videos only expose metadata once playback starts.
              if (playing) {
                setTitle(
                  (previous) =>
                    previous ?? target.getVideoData?.().title ?? null
                )
              }
            },
            onPlaybackRateChange: ({ data }) => {
              rateRef.current = data
              setRate(data)
            },
            onError: ({ data }) => {
              setStatus("error")
              setErrorReason(youTubeErrorReason(data))
            }
          }
        })
      })
      .catch(() => {
        if (isCancelled) return
        setStatus("error")
        setErrorReason("apiUnavailable")
      })

    return () => {
      isCancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      host.replaceChildren()
    }
  }, [hostRef, videoId])

  const getCurrentTimeMs = useCallback(() => {
    const player = playerRef.current
    if (!player) return 0
    const now = performance.now()
    const seconds = player.getCurrentTime()
    const reported = reportedRef.current
    if (seconds !== reported.seconds) {
      reportedRef.current = { seconds, atMs: now }
      return seconds * MS_PER_SECOND
    }
    if (!isPlayingRef.current) return seconds * MS_PER_SECOND
    const elapsed = Math.min(now - reported.atMs, MAX_EXTRAPOLATION_MS)
    return seconds * MS_PER_SECOND + elapsed * rateRef.current
  }, [])

  const seekToMs = useCallback((timeMs: number) => {
    const player = playerRef.current
    if (!player) return
    const seconds = Math.max(0, timeMs / MS_PER_SECOND)
    player.seekTo(seconds, true)
    reportedRef.current = { seconds, atMs: performance.now() }
  }, [])

  const play = useCallback(() => playerRef.current?.playVideo(), [])
  const pause = useCallback(() => playerRef.current?.pauseVideo(), [])
  const setPlaybackRate = useCallback((rate: number) => {
    playerRef.current?.setPlaybackRate(rate)
  }, [])

  return {
    status,
    errorReason,
    isPlaying,
    playbackRate,
    availableRates,
    title,
    getCurrentTimeMs,
    seekToMs,
    play,
    pause,
    setPlaybackRate
  }
}
