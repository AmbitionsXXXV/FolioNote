import type { AnalyzedText, JapaneseAnalyzer, Word } from "@folionote/japanese"
import {
  chunkSentences,
  DEFAULT_MAX_CHARS,
  splitArticle
} from "@folionote/japanese"

import { analyzeJapaneseText } from "./japanese-runtime"

export interface LexiconRow {
  headword: string
  reading?: string
  meanings?: string[]
  pos?: string
  unit?: string
}
export interface PreparedLexiconEntry {
  position: number
  headword: string
  reading: string | null
  readingSource: "file" | "engine" | null
  meanings: string[]
  pos: string | null
  unit: string | null
  baseForm: string
}
interface ValidationRow {
  index: number
  status: "ready" | "reading-filled" | "duplicate" | "error"
  reading: string | null
  message?: string
}

export function mergeLexiconEntries(entries: PreparedLexiconEntry[]) {
  const unique = new Map<string, PreparedLexiconEntry>()
  const duplicates = new Set<number>()
  for (const entry of entries) {
    const key = JSON.stringify([entry.headword, entry.reading])
    const previous = unique.get(key)
    if (previous) {
      previous.meanings = [
        ...new Set([...previous.meanings, ...entry.meanings])
      ]
      duplicates.add(entry.position)
    } else {
      unique.set(key, { ...entry, meanings: [...new Set(entry.meanings)] })
    }
  }
  return { entries: [...unique.values()], duplicates }
}

export async function prepareLexiconRows(
  rows: LexiconRow[],
  analyzer: JapaneseAnalyzer | null
) {
  const entries: PreparedLexiconEntry[] = []
  const statuses: ValidationRow[] = []
  const cache = new Map<string, AnalyzedText>()
  let readingsFilled = 0
  let errors = 0
  for (const [index, row] of rows.entries()) {
    const headword = row.headword.trim()
    if (!headword) {
      statuses.push({
        index,
        status: "error",
        reading: null,
        message: "Headword is empty"
      })
      errors++
      continue
    }
    let reading = row.reading?.trim() || null
    let readingSource: PreparedLexiconEntry["readingSource"] = reading
      ? "file"
      : null
    let baseForm = headword
    if (analyzer) {
      let result = cache.get(headword)
      if (!result) {
        result = await analyzeJapaneseText(headword, analyzer)
        cache.set(headword, result)
      }
      const words = result.words.filter((word) => !word.isPunctuation)
      baseForm = words[0]?.baseForm || headword
      if (
        !reading &&
        result.containsJapanese &&
        words.length > 0 &&
        words.every((word) => word.reading)
      ) {
        reading = words.map((word) => word.reading).join("")
        readingSource = "engine"
        readingsFilled++
      }
    }
    entries.push({
      position: index,
      headword,
      reading,
      readingSource,
      baseForm,
      meanings: (row.meanings ?? [])
        .map((meaning) => meaning.trim())
        .filter(Boolean),
      pos: row.pos?.trim() || null,
      unit: row.unit?.trim() || null
    })
    statuses.push({
      index,
      status: readingSource === "engine" ? "reading-filled" : "ready",
      reading
    })
  }
  const merged = mergeLexiconEntries(entries)
  for (const row of statuses) {
    if (merged.duplicates.has(row.index)) row.status = "duplicate"
  }
  return {
    entries: merged.entries,
    rows: statuses,
    summary: {
      total: rows.length,
      ready: merged.entries.length,
      readingsFilled,
      duplicatesMerged: merged.duplicates.size,
      errors
    }
  }
}

export interface ArticleAnalysis {
  chunks: { start: number; end: number; result: AnalyzedText }[]
}
export function contentWords(analysis: ArticleAnalysis): Word[] {
  return analysis.chunks
    .flatMap(({ result }) => result.words)
    .filter((word) => !word.isPunctuation && word.pos !== "particle")
}

export async function analyzeArticle(
  text: string,
  analyzer: JapaneseAnalyzer
): Promise<ArticleAnalysis> {
  const { sentences } = splitArticle(text)
  const chunks: ArticleAnalysis["chunks"] = []
  for (const span of chunkSentences(text, sentences, DEFAULT_MAX_CHARS)) {
    const part = text.slice(span.start, span.end)
    if (!part.trim()) continue
    chunks.push({ ...span, result: await analyzeJapaneseText(part, analyzer) })
  }
  return { chunks }
}

export type VocabLevel = "N5" | "N4" | "N3" | "N2" | "N1"
export interface LevelVocab {
  word: string
  otherForms: string[]
  level: VocabLevel
  /** Dictionary-form reading; optional so callers without it still work. */
  reading?: string
}

/** Count occurrences, with easiest level winning when multiple dictionary rows match. */
export function articleWordStats(
  words: Word[],
  vocab: LevelVocab[],
  knownBaseForms: Set<string>
) {
  const levels = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0, unlisted: 0 }
  const levelByForm = new Map<string, VocabLevel>()
  const readingByForm = new Map<string, string>()
  for (const entry of vocab) {
    for (const form of [entry.word, ...entry.otherForms]) {
      const previous = levelByForm.get(form)
      if (!previous || entry.level > previous) {
        levelByForm.set(form, entry.level)
        if (entry.reading) readingByForm.set(form, entry.reading)
      }
    }
  }
  const unknown = new Map<
    string,
    { baseForm: string; reading: string | null; count: number }
  >()
  let notInLists = 0
  let count = 0
  for (const word of words) {
    if (word.isPunctuation || word.pos === "particle") continue
    count++
    levels[levelByForm.get(word.baseForm) ?? "unlisted"]++
    if (!knownBaseForms.has(word.baseForm)) {
      notInLists++
      const previous = unknown.get(word.baseForm)
      if (previous) previous.count++
      else
        unknown.set(word.baseForm, {
          baseForm: word.baseForm,
          // A word's own reading is its inflected surface (開店した → かいてんした),
          // so only trust it for uninflected words; otherwise use the word bank.
          reading:
            readingByForm.get(word.baseForm) ??
            (word.tail ? null : word.reading),
          count: 1
        })
    }
  }
  return {
    words: count,
    notInLists,
    levels,
    newWords: [...unknown.values()]
      .toSorted(
        (a, b) => b.count - a.count || a.baseForm.localeCompare(b.baseForm)
      )
      .slice(0, 30)
  }
}
