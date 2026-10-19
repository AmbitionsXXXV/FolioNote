import type { AnalyzedText, Morpheme, Phrase, Word } from "@folionote/japanese"
import { splitArticle } from "@folionote/japanese"

/** Shape persisted by japanese.articles.* (one analysis per ≤2,000-char chunk). */
export interface ArticleAnalysis {
  chunks: { start: number; end: number; result: AnalyzedText }[]
}

export interface ArticleSentence {
  id: string
  text: string
  /** Segmentation of this sentence, or null when the engine has not run yet. */
  analysis: AnalyzedText | null
}

export interface ArticleParagraph {
  id: string
  sentences: ArticleSentence[]
}

const shiftSpan = <T extends { start: number; end: number }>(
  span: T,
  offset: number
): T => ({ ...span, start: span.start - offset, end: span.end - offset })

/**
 * Cuts a chunk analysis down to the [start, end) span and re-indexes it so
 * words, morphemes and phrases reference each other like a fresh analysis.
 * Offsets become relative to the slice.
 */
export function sliceAnalyzedText(
  result: AnalyzedText,
  start: number,
  end: number
): AnalyzedText {
  const morphemeIndex = new Map<number, number>()
  const morphemes: Morpheme[] = []
  for (const [index, morpheme] of result.morphemes.entries()) {
    if (morpheme.start >= start && morpheme.end <= end) {
      morphemeIndex.set(index, morphemes.length)
      morphemes.push(shiftSpan(morpheme, start))
    }
  }

  const wordIndex = new Map<number, number>()
  const words: Word[] = []
  for (const word of result.words) {
    if (word.start < start || word.end > end) continue
    wordIndex.set(word.index, words.length)
    words.push({
      ...shiftSpan(word, start),
      index: words.length,
      morphemeIndexes: word.morphemeIndexes
        .map((index) => morphemeIndex.get(index))
        .filter((index): index is number => index !== undefined),
      tail: word.tail ? shiftSpan(word.tail, start) : null
    })
  }

  const phrases: Phrase[] = []
  for (const phrase of result.phrases) {
    const members = phrase.wordIndexes.map((index) => wordIndex.get(index))
    if (members.length === 0) continue
    if (!members.every((index): index is number => index !== undefined))
      continue
    phrases.push({
      ...shiftSpan(phrase, start),
      index: phrases.length,
      wordIndexes: members
    })
  }

  return {
    ...result,
    text: result.text.slice(start, end),
    morphemes,
    words,
    phrases
  }
}

/**
 * Splits an article into paragraphs of sentences and attaches each sentence's
 * slice of the stored analysis. A sentence the chunking split in two (longer
 * than the engine limit) falls back to plain text.
 */
export function articleParagraphs(
  text: string,
  analysis: ArticleAnalysis | null
): ArticleParagraph[] {
  const { paragraphs, sentences } = splitArticle(text)
  const groups: ArticleParagraph[] = paragraphs.map((_, index) => ({
    id: `p${index}`,
    sentences: []
  }))
  const loose: ArticleParagraph = { id: "p-loose", sentences: [] }

  for (const [index, span] of sentences.entries()) {
    const chunk = analysis?.chunks.find(
      (candidate) => candidate.start <= span.start && span.end <= candidate.end
    )
    const sentence: ArticleSentence = {
      id: `s${index}`,
      text: text.slice(span.start, span.end),
      analysis: chunk
        ? sliceAnalyzedText(
            chunk.result,
            span.start - chunk.start,
            span.end - chunk.start
          )
        : null
    }
    const paragraphIndex = paragraphs.findIndex(
      (paragraph) => paragraph.start <= span.start && span.start < paragraph.end
    )
    const group = groups[paragraphIndex] ?? loose
    group.sentences.push(sentence)
  }

  if (loose.sentences.length > 0) groups.push(loose)
  return groups.filter((group) => group.sentences.length > 0)
}

/** The first sentence of an article, for the import preview. */
export function firstArticleSentence(
  text: string,
  analysis: ArticleAnalysis | null
): ArticleSentence | null {
  return articleParagraphs(text, analysis)[0]?.sentences[0] ?? null
}

/** Dictionary forms worth tagging: every word except punctuation and particles. */
export function contentBaseForms(analyses: (AnalyzedText | null)[]): string[] {
  const forms = new Set<string>()
  for (const analysis of analyses) {
    if (!analysis) continue
    for (const word of analysis.words) {
      if (!word.isPunctuation && word.pos !== "particle") {
        forms.add(word.baseForm)
      }
    }
  }
  return [...forms].toSorted()
}
