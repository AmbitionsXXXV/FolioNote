import type { RubySegment } from "@folionote/japanese"

interface JapaneseRubyProps {
  segments: RubySegment[]
  /** Hide the readings while keeping the surface text in place. */
  showReading?: boolean
  className?: string
}

/**
 * Surface text with per-kanji furigana as real <ruby>/<rt>. Kana segments
 * render as bare text so readings sit only over the kanji they belong to.
 */
export function JapaneseRuby({
  segments,
  showReading = true,
  className
}: JapaneseRubyProps) {
  return (
    <span className={className} lang="ja">
      {segments.map((segment, index) => {
        const key = `${index}-${segment.text}`
        if (segment.reading === undefined) {
          return <span key={key}>{segment.text}</span>
        }
        return (
          <ruby key={key}>
            {segment.text}
            {showReading ? (
              <rt className="text-[0.5em] leading-none font-normal text-muted-foreground">
                {segment.reading}
              </rt>
            ) : null}
          </ruby>
        )
      })}
    </span>
  )
}
