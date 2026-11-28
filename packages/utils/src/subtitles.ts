/** One timed caption line, in milliseconds from the start of the media. */
export interface SubtitleCue {
  /** 0-based position after sorting by start time. */
  index: number
  startMs: number
  endMs: number
  text: string
}

// `00:01:02,345`, `01:02.345` (VTT allows omitting hours), `,` (SRT) or `.` (VTT).
const TIMESTAMP_PATTERN = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/
const TIMING_LINE_PATTERN =
  /^\s*((?:\d+:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[,.]\d{1,3})/
const BYTE_ORDER_MARK_PATTERN = /^\uFEFF/
const LINE_BREAK_PATTERN = /\r\n?|\n/g
const BLOCK_SEPARATOR_PATTERN = /\n\s*\n/
// VTT voice/class/karaoke tags (`<v Roger>`, `<c.red>`, `<00:00:01.000>`) and HTML-ish SRT tags.
const MARKUP_TAG_PATTERN = /<[^>]*>/g
// ASS-style override blocks some SRT exporters leave in, e.g. `{\an8}`.
const ASS_OVERRIDE_PATTERN = /\{\\[^}]*\}/g
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'"
}
const HTML_ENTITY_PATTERN = /&(?:amp|lt|gt|nbsp|quot|#39);/g
const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE

const parseTimestampMs = (value: string): number | null => {
  const match = TIMESTAMP_PATTERN.exec(value)
  if (!match) return null
  const [, hours = "0", minutes = "0", seconds = "0", fraction = "0"] = match
  // `1.5` means 500 ms, not 5 ms, so right-pad the fraction to 3 digits.
  const millis = Number(fraction.padEnd(3, "0"))
  return (
    Number(hours) * MS_PER_HOUR +
    Number(minutes) * MS_PER_MINUTE +
    Number(seconds) * MS_PER_SECOND +
    millis
  )
}

const cleanCueText = (lines: string[]): string =>
  lines
    .map((line) =>
      line
        .replace(MARKUP_TAG_PATTERN, "")
        .replace(ASS_OVERRIDE_PATTERN, "")
        .replace(
          HTML_ENTITY_PATTERN,
          (entity) => HTML_ENTITIES[entity] ?? entity
        )
        .trim()
    )
    .filter((line) => line.length > 0)
    .join("\n")

/**
 * Parses SRT or WebVTT text into cues sorted by start time.
 *
 * Both formats share the `start --> end` timing line, so one block-based parser
 * covers them: everything before the timing line in a block is a cue number or
 * VTT identifier, everything after it is caption text. Blocks without a timing
 * line (the WEBVTT header, NOTE, STYLE, REGION) are skipped. Cues with empty
 * text or a non-positive duration are dropped because they cannot be
 * highlighted or looped.
 */
export function parseSubtitles(source: string): SubtitleCue[] {
  const normalized = source.replace(/^﻿/, "").replace(LINE_BREAK_PATTERN, "\n")
  const parsed: Omit<SubtitleCue, "index">[] = []

  for (const block of normalized.split(BLOCK_SEPARATOR_PATTERN)) {
    const lines = block.split("\n")
    const timingLineIndex = lines.findIndex((line) =>
      TIMING_LINE_PATTERN.test(line)
    )
    if (timingLineIndex === -1) continue

    const timing = TIMING_LINE_PATTERN.exec(lines[timingLineIndex] ?? "")
    const startMs = timing?.[1] ? parseTimestampMs(timing[1]) : null
    const endMs = timing?.[2] ? parseTimestampMs(timing[2]) : null
    if (startMs === null || endMs === null || endMs <= startMs) continue

    const text = cleanCueText(lines.slice(timingLineIndex + 1))
    if (text.length === 0) continue

    parsed.push({ startMs, endMs, text })
  }

  return parsed
    .toSorted((a, b) => a.startMs - b.startMs)
    .map((cue, index) => ({ ...cue, index }))
}

/**
 * Returns the index of the cue to highlight at `timeMs`, or -1 before the first cue.
 *
 * Between two cues the previous one stays highlighted, so the reader keeps their
 * place during pauses in speech instead of watching the highlight flicker off.
 * `cues` must be sorted by start time (as `parseSubtitles` returns them).
 */
export function findActiveCueIndex(
  cues: readonly SubtitleCue[],
  timeMs: number
): number {
  let low = 0
  let high = cues.length - 1
  let found = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const cue = cues[middle]
    if (cue && cue.startMs <= timeMs) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}

/** Formats milliseconds as `m:ss` or `h:mm:ss` for cue timestamps in the transcript. */
export function formatCueTime(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeMs / MS_PER_SECOND))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
  }
  return `${minutes}:${seconds}`
}
