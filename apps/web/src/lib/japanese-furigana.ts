import type { RubySegment } from "@folionote/japanese"

const FURIGANA_MARKUP = /\{([^|}]+)\|([^}]+)\}/g

/**
 * Parses OpenJLPT example furigana ("{食|た}べる") into ruby segments. Text
 * outside braces becomes plain segments; braces become kanji + reading pairs.
 */
export function parseFuriganaMarkup(markup: string): RubySegment[] {
  const segments: RubySegment[] = []
  let cursor = 0

  for (const match of markup.matchAll(FURIGANA_MARKUP)) {
    const index = match.index ?? 0
    if (index > cursor) {
      segments.push({ text: markup.slice(cursor, index) })
    }
    const [, text, reading] = match
    if (text && reading) {
      segments.push({ text, reading })
    }
    cursor = index + match[0].length
  }

  if (cursor < markup.length) {
    segments.push({ text: markup.slice(cursor) })
  }

  return segments
}

/**
 * Splits ruby segments at a surface offset so a word's head and inflection
 * tail can be underlined separately. A kanji segment that straddles the
 * offset stays whole in the head: its reading cannot be divided.
 */
export function splitRubyAt(
  segments: RubySegment[],
  offset: number
): [RubySegment[], RubySegment[]] {
  const head: RubySegment[] = []
  const tail: RubySegment[] = []
  let position = 0

  for (const segment of segments) {
    const end = position + segment.text.length
    if (end <= offset) {
      head.push(segment)
    } else if (position >= offset) {
      tail.push(segment)
    } else if (segment.reading === undefined) {
      head.push({ text: segment.text.slice(0, offset - position) })
      tail.push({ text: segment.text.slice(offset - position) })
    } else {
      head.push(segment)
    }
    position = end
  }

  return [head, tail]
}
