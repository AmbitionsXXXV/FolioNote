import type { AnalyzedText, Word } from "@folionote/japanese"
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
import { ListenLineWords, ListenWordPanel } from "./listen-line-words"

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
interface SelectedWord {
  cueIndex: number
  word: Word
  analysis: AnalyzedText
}

export function ListenPlayer({
  materialId,
  videoId,
  title,
  cues,
  initialIndex,
  onActiveIndexChange,
  onChangeSource
}: {
  materialId: string
  videoId: string
  /** Saved title; the player's own title is used until it loads. */
  title: string
  cues: SubtitleCue[]
  /** Line to start from (resume point or a notebook link's timestamp). */
  initialIndex: number
  onActiveIndexChange: (index: number) => void
  onChangeSource: () => void
}) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const player = useYouTubePlayer(hostRef, videoId)
  const { getCurrentTimeMs, seekToMs, play, pause, status } = player
  const [activeIndex, setActiveIndex] = useState(-1)
  const [selected, setSelected] = useState<SelectedWord | null>(null)
  const hasResumedRef = useRef(false)
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

  // Jump to the resume line once, without starting playback (autoplay rules,
  // and the reader may just be looking).
  useEffect(() => {
    if (status !== "ready" || hasResumedRef.current) return
    hasResumedRef.current = true
    const cue = cues[initialIndex]
    if (!cue || initialIndex === 0) return
    seekToMs(cue.startMs + offsetMs - SEEK_LEAD_MS)
    activeIndexRef.current = initialIndex
    setActiveIndex(initialIndex)
  }, [cues, initialIndex, offsetMs, seekToMs, status])

  useEffect(() => {
    if (activeIndex >= 0) onActiveIndexChange(activeIndex)
  }, [activeIndex, onActiveIndexChange])

  const selectWord = useCallback(
    (cueIndex: number, word: Word, analysis: AnalyzedText) => {
      pause()
      setSelected((current) =>
        current?.cueIndex === cueIndex && current.word.index === word.index
          ? null
          : { cueIndex, word, analysis }
      )
    },
    [pause]
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
          <p className="line-clamp-2 min-w-0 text-sm font-medium">{title}</p>
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
          <span className="min-w-14 text-center font-mono text-foreground tabular-nums">
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

        {selected ? (
          <ListenWordPanel
            analysis={selected.analysis}
            materialId={materialId}
            timeMs={cues[selected.cueIndex]?.startMs ?? 0}
            word={selected.word}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("japanese.listen.transcript.tapWordHint")}
          </p>
        )}
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
                {isActive ? (
                  // The current line's words are their own buttons, so the
                  // row can't be one; its timestamp replays the line instead.
                  <div
                    aria-current="true"
                    className="flex w-full gap-3 rounded-xl bg-primary/12 px-3 py-2.5 text-foreground ring-1 ring-primary/25"
                  >
                    <button
                      aria-label={t("japanese.listen.transcript.replayLine")}
                      className="mt-0.5 w-12 shrink-0 self-start rounded-sm text-left font-mono text-[11px] tabular-nums opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                      disabled={status !== "ready"}
                      onClick={() => seekToCue(cue.index)}
                      type="button"
                    >
                      {formatCueTime(cue.startMs)}
                    </button>
                    <div className="min-w-0 flex-1 font-script-ja text-lg leading-relaxed">
                      <ListenLineWords
                        onSelectWord={(word, analysis) =>
                          selectWord(cue.index, word, analysis)
                        }
                        selectedWordIndex={
                          selected?.cueIndex === cue.index
                            ? selected.word.index
                            : null
                        }
                        text={cue.text}
                      />
                    </div>
                    {isLooping ? (
                      <HugeiconsIcon
                        aria-label={t("japanese.listen.player.looping")}
                        className="mt-1 shrink-0 text-primary"
                        icon={RefreshIcon}
                        size={14}
                      />
                    ) : null}
                  </div>
                ) : (
                  <button
                    className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
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
                  </button>
                )}
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
