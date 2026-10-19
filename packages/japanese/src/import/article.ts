import type { TextSpan } from "../types"

const LINE_BREAK = /\r\n|\r|\n/g
const PARAGRAPH = /\S[^]*?(?=\n[\t ]*\n|$)/g
const SENTENCE_END = /[。！？!?]+[」』）)]*|\n/g

/** CRLF is one logical newline; all returned offsets still address the input. */
export function splitArticle(text: string): {
  title: string | null
  paragraphs: TextSpan[]
  sentences: TextSpan[]
} {
  const offsets: number[] = []
  let normalized = ""
  let previous = 0
  for (const match of text.matchAll(LINE_BREAK)) {
    for (let i = previous; i < match.index; i++) {
      offsets.push(i)
      normalized += text[i]
    }
    offsets.push(match.index)
    normalized += "\n"
    previous = match.index + match[0].length
  }
  for (let i = previous; i < text.length; i++) {
    offsets.push(i)
    normalized += text[i]
  }
  offsets.push(text.length)
  const lines = normalized.split("\n")
  const first = lines[0]?.trim() ?? ""
  const title =
    first && first.length <= 40 && lines[1]?.trim() === "" ? first : null
  const span = (start: number, end: number): TextSpan => ({
    start: offsets[start] ?? text.length,
    end: offsets[end] ?? text.length
  })
  const paragraphs = [...normalized.matchAll(PARAGRAPH)].map((match) =>
    span(match.index, match.index + match[0].trimEnd().length)
  )
  const sentences: TextSpan[] = []
  let start = 0
  const append = (end: number) => {
    const segment = normalized.slice(start, end)
    const trimmed = segment.trim()
    if (trimmed) {
      const leading = segment.length - segment.trimStart().length
      sentences.push(span(start + leading, start + leading + trimmed.length))
    }
    start = end
  }
  for (const match of normalized.matchAll(SENTENCE_END)) {
    append(match.index + match[0].length)
  }
  append(normalized.length)
  return { title, paragraphs, sentences }
}

/** Chunks cover the entire input, including inter-sentence whitespace. */
export function chunkSentences(
  text: string,
  sentences: TextSpan[],
  maxChars: number
): TextSpan[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new RangeError("maxChars must be a positive integer")
  }
  const chunks: TextSpan[] = []
  let start = 0
  let end = 0
  const append = (next: number, wholeSentence: boolean) => {
    if (wholeSentence && next - start > maxChars && end > start) {
      chunks.push({ start, end })
      start = end
    }
    while (next - start > maxChars) {
      chunks.push({ start, end: start + maxChars })
      start += maxChars
    }
    end = next
  }
  for (const sentence of sentences) {
    append(sentence.start, false)
    append(sentence.end, true)
  }
  append(text.length, false)
  if (end > start) chunks.push({ start, end })
  return chunks
}
