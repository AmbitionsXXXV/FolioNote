import type { SubtitleCue } from "@folionote/utils/subtitles"
import { findActiveCueIndex, formatCueTime } from "@folionote/utils/subtitles"
import { Button } from "@heroui/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  RefreshIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useYouTubePlayer } from "@/hooks/use-youtube-player"
import { cn } from "@/lib/utils"

import { NATIVE_SELECT_CLASS, TogglePill } from "../japanese-reading-controls"

const OFFSET_STEP_MS = 250
// Seeking lands a hair early so the first syllable of the line isn't clipped.
const SEEK_LEAD_MS = 80

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/**
 * Official YouTube embed + a transcript that follows playback: the current line
 * is highlighted, tapping a line seeks to it, one line can loop, and speed and
 * caption offset are adjustable (user-supplied SRT/VTT often drifts).
 */
export function ListenPlayer({
  videoId,
  cues,
  onChangeSource
}: {
  videoId: string
  cues: SubtitleCue[]
  onChangeSource: () => void
}) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const player = useYouTubePlayer(hostRef, videoId)
  const { getCurrentTimeMs, seekToMs, play, pause, status } = player
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loopIndex, setLoopIndex] = useState<number | null>(null)
  // Added to every cue time: positive when the captions run ahead of the voice.
  const [offsetMs, setOffsetMs] = useState(0)
  const [isFollowing, setIsFollowing] = useState(true)
  const listRef = useRef<HTMLOListElement>(null)
  const lineRefs = useRef(new Map<number, HTMLLIElement>())
  const activeIndexRef = useRef(-1)

  const seekToCue = useCallback(
    (index: number) => {
      const cue = cues[index]
      if (!cue) return
      seekToMs(cue.startMs + offsetMs - SEEK_LEAD_MS)
      activeIndexRef.current = index
      setActiveIndex(index)
      setIsFollowing(true)
      setLoopIndex((current) => (current === null ? null : index))
      play()
    },
    [cues, offsetMs, play, seekToMs]
  )

  // One rAF loop drives the highlight and the single-line loop. It runs while
  // paused too, so scrubbing with YouTube's own controls moves the highlight.
  useEffect(() => {
    if (status !== "ready") return
    let frame = 0
    const tick = () => {
      const mediaMs = getCurrentTimeMs()
      const cueTimeMs = mediaMs - offsetMs
      if (loopIndex !== null) {
        const loopCue = cues[loopIndex]
        if (loopCue && cueTimeMs >= loopCue.endMs) {
          seekToMs(loopCue.startMs + offsetMs - SEEK_LEAD_MS)
        }
      }
      const index = findActiveCueIndex(cues, cueTimeMs)
      if (index !== activeIndexRef.current) {
        activeIndexRef.current = index
        setActiveIndex(index)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cues, getCurrentTimeMs, loopIndex, offsetMs, seekToMs, status])

  // Keep the current line in view unless the reader scrolled away on purpose.
  useEffect(() => {
    if (!isFollowing || activeIndex < 0) return
    const list = listRef.current
    const line = lineRefs.current.get(activeIndex)
    if (!list || !line) return
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    // Scroll only the transcript, not the page: scrollIntoView would also move
    // the window and push the player off screen on phones.
    list.scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: line.offsetTop - list.clientHeight / 2 + line.clientHeight / 2
    })
  }, [activeIndex, isFollowing])

  const toggleLoop = useCallback(() => {
    setLoopIndex((current) =>
      current === null ? Math.max(activeIndexRef.current, 0) : null
    )
  }, [])

  // Space play/pause, ←/→ previous/next line, R loop. Ignored while typing or
  // composing (IME) so the shortcuts never eat Japanese input.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      const current = activeIndexRef.current
      if (event.key === " ") {
        // A focused button (e.g. the line just tapped) keeps Space for itself.
        if (event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        if (player.isPlaying) pause()
        else play()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        seekToCue(Math.max(current - 1, 0))
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        seekToCue(Math.min(current + 1, cues.length - 1))
      } else if (event.key === "r" || event.key === "R") {
        toggleLoop()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cues.length, pause, play, player.isPlaying, seekToCue, toggleLoop])

  const pauseFollowing = () => setIsFollowing(false)
  const offsetLabel = `${offsetMs > 0 ? "+" : ""}${(offsetMs / 1000).toFixed(2)}s`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <div
            className="absolute inset-0 [&>iframe]:size-full"
            ref={hostRef}
          />
          {status === "error" ? (
            <div
              className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white"
              role="alert"
            >
              {t(
                `japanese.listen.player.error.${player.errorReason ?? "playback"}`
              )}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="line-clamp-2 min-w-0 text-sm font-medium">
            {player.title ?? t("japanese.listen.player.untitled")}
          </p>
          <Button onPress={onChangeSource} size="sm" variant="ghost">
            {t("japanese.listen.player.changeSource")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-label={t("japanese.listen.player.previous")}
            isDisabled={status !== "ready"}
            isIconOnly
            onPress={() => seekToCue(Math.max(activeIndex - 1, 0))}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={ArrowLeft01Icon}
              size={16}
            />
          </Button>
          <Button
            isDisabled={status !== "ready"}
            onPress={player.isPlaying ? pause : play}
            size="sm"
            variant="primary"
          >
            {player.isPlaying
              ? t("japanese.listen.player.pause")
              : t("japanese.listen.player.play")}
          </Button>
          <Button
            aria-label={t("japanese.listen.player.next")}
            isDisabled={status !== "ready"}
            isIconOnly
            onPress={() =>
              seekToCue(Math.min(activeIndex + 1, cues.length - 1))
            }
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={ArrowRight01Icon}
              size={16}
            />
          </Button>
          <TogglePill
            isPressed={loopIndex !== null}
            label={t("japanese.listen.player.loop")}
            onToggle={toggleLoop}
          />
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {t("japanese.listen.player.speed")}
            <select
              className={cn(NATIVE_SELECT_CLASS, "min-h-9 w-auto")}
              disabled={status !== "ready"}
              onChange={(event) =>
                player.setPlaybackRate(Number(event.target.value))
              }
              value={player.playbackRate}
            >
              {player.availableRates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}×
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t("japanese.listen.player.offset")}</span>
          <Button
            onPress={() => setOffsetMs((value) => value - OFFSET_STEP_MS)}
            size="sm"
            variant="ghost"
          >
            −0.25s
          </Button>
          <span className="min-w-14 text-center font-mono tabular-nums text-foreground">
            {offsetLabel}
          </span>
          <Button
            onPress={() => setOffsetMs((value) => value + OFFSET_STEP_MS)}
            size="sm"
            variant="ghost"
          >
            +0.25s
          </Button>
          <span className="basis-full">
            {t("japanese.listen.player.offsetHint")}
          </span>
          <span className="basis-full">
            {t("japanese.listen.player.shortcuts")}
          </span>
        </div>
      </div>

      <section
        aria-label={t("japanese.listen.transcript.label")}
        className="relative"
      >
        <ol
          className="relative flex max-h-[70vh] flex-col gap-1 overflow-y-auto overscroll-contain rounded-2xl bg-surface p-2 ring-1 ring-border/60"
          onTouchMove={pauseFollowing}
          onWheel={pauseFollowing}
          ref={listRef}
        >
          {cues.map((cue) => {
            const isActive = cue.index === activeIndex
            const isLooping = cue.index === loopIndex
            return (
              <li
                key={cue.index}
                ref={(element) => {
                  if (element) lineRefs.current.set(cue.index, element)
                  else lineRefs.current.delete(cue.index)
                }}
              >
                <button
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
                    isActive
                      ? "bg-primary/12 text-foreground ring-1 ring-primary/25"
                      : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                  )}
                  disabled={status !== "ready"}
                  onClick={() => seekToCue(cue.index)}
                  type="button"
                >
                  <span className="mt-0.5 w-12 shrink-0 font-mono text-[11px] tabular-nums opacity-70">
                    {formatCueTime(cue.startMs)}
                  </span>
                  <span
                    className="font-script-ja text-base leading-relaxed whitespace-pre-line"
                    lang="ja"
                  >
                    {cue.text}
                  </span>
                  {isLooping ? (
                    <HugeiconsIcon
                      aria-label={t("japanese.listen.player.looping")}
                      className="mt-1 ml-auto shrink-0 text-primary"
                      icon={RefreshIcon}
                      size={14}
                    />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ol>
        {isFollowing ? null : (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Button
              className="pointer-events-auto shadow-md"
              onPress={() => setIsFollowing(true)}
              size="sm"
              variant="secondary"
            >
              {t("japanese.listen.transcript.backToCurrent")}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
