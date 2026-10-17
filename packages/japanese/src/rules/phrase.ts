import type { Phrase, Word } from "../types"

const OPENING_PUNCTUATION = /^[\p{Ps}\p{Pi}]+$/u

function isOpening(word: Word): boolean {
  return word.isPunctuation && OPENING_PUNCTUATION.test(word.surface)
}

function attachesBackward(word: Word): boolean {
  return (
    word.isPunctuation || word.pos === "particle" || word.pos === "auxiliary"
  )
}

/**
 * Bunsetsu-style grouping: every content word opens a phrase; particles,
 * auxiliaries and punctuation join the phrase before them. Opening brackets
 * join the phrase AFTER them (「ありがとう」と), otherwise 「 would dangle off
 * the previous phrase.
 */
export function buildPhrases(words: readonly Word[]): Phrase[] {
  const groups: number[][] = []
  let carried: number[] = []

  for (const word of words) {
    if (isOpening(word)) {
      carried.push(word.index)
      continue
    }
    const current = groups.at(-1)
    if (attachesBackward(word) && current) {
      current.push(...carried, word.index)
      carried = []
      continue
    }
    if (attachesBackward(word)) {
      carried.push(word.index)
      continue
    }
    groups.push([...carried, word.index])
    carried = []
  }

  if (carried.length > 0) {
    const current = groups.at(-1)
    if (current) {
      current.push(...carried)
    } else {
      groups.push(carried)
    }
  }

  return groups.map((wordIndexes, index) => {
    const first = words[wordIndexes[0] ?? 0]
    const last = words[wordIndexes.at(-1) ?? 0]
    return {
      end: last?.end ?? 0,
      index,
      start: first?.start ?? 0,
      wordIndexes
    }
  })
}
