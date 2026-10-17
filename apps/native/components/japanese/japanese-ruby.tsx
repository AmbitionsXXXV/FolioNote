import type { RubySegment } from "@folionote/japanese"
import { cn } from "heroui-native"
import { Text, View } from "react-native"

import { rubyReading, rubySurface } from "@/lib/japanese-furigana"

interface JapaneseRubyProps {
  segments: RubySegment[]
  /** Surface font size in points; the reading is drawn at half that size. */
  fontSize: number
  /** Hide the readings while keeping the surface text in place. */
  showReading?: boolean
  /** Allow line breaks between characters (long example sentences). */
  wrap?: boolean
  /** Announce surface + reading as one VoiceOver element. Off when a parent button already labels it. */
  accessible?: boolean
  textClassName?: string
  readingClassName?: string
  className?: string
}

const READING_RATIO = 0.5
const SURFACE_LINE_HEIGHT_RATIO = 1.3
const READING_LINE_HEIGHT_EXTRA = 3
const NBSP = " "

/**
 * Kana runs are single columns while wrapping is off, so a word stays whole.
 * When wrapping is on, each kana character becomes its own column so the
 * row can break anywhere, like plain text would.
 */
function toColumns(segments: RubySegment[], wrap: boolean): RubySegment[] {
  if (!wrap) {
    return segments
  }
  const columns: RubySegment[] = []
  for (const segment of segments) {
    if (segment.reading === undefined) {
      for (const char of segment.text) {
        columns.push({ text: char })
      }
    } else {
      columns.push(segment)
    }
  }
  return columns
}

/**
 * Surface text with per-kanji furigana. React Native has no <ruby>, so each
 * segment is a column: reading on top, surface below, aligned on the baseline.
 */
export function JapaneseRuby({
  segments,
  fontSize,
  showReading = true,
  wrap = false,
  accessible = true,
  textClassName,
  readingClassName,
  className
}: JapaneseRubyProps) {
  const readingSize = Math.round(fontSize * READING_RATIO)
  const columns = toColumns(segments, wrap)
  const surface = rubySurface(segments)
  const reading = rubyReading(segments)
  const label = reading === surface ? surface : `${surface}、${reading}`

  return (
    <View
      accessibilityLabel={accessible ? label : undefined}
      accessible={accessible}
      className={cn("flex-row items-end", wrap && "flex-wrap", className)}
    >
      {columns.map((segment, index) => (
        <View className="items-center" key={`${index}-${segment.text}`}>
          {showReading ? (
            <Text
              className={cn("text-muted", readingClassName)}
              numberOfLines={1}
              style={{
                fontSize: readingSize,
                lineHeight: readingSize + READING_LINE_HEIGHT_EXTRA
              }}
            >
              {segment.reading ?? NBSP}
            </Text>
          ) : null}
          <Text
            className={cn("text-foreground", textClassName)}
            style={{
              fontSize,
              lineHeight: Math.round(fontSize * SURFACE_LINE_HEIGHT_RATIO)
            }}
          >
            {segment.text}
          </Text>
        </View>
      ))}
    </View>
  )
}
