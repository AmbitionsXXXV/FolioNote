import { isWhitespaceMorpheme } from "../pipeline/classify"
import type { LearnerPos, Morpheme } from "../types"

export interface WordDraft {
  morphemeIndexes: number[]
  pos: LearnerPos
  baseForm: string
  /** Morpheme index where the inflection/auxiliary tail begins. */
  tailStart: number | null
}

const CONJUNCTIVE_TAILS = new Set(["て", "で", "ば"])

function lemma(morpheme: Morpheme): string {
  return morpheme.baseForm ?? morpheme.surface
}

function hasDetail(
  morpheme: Morpheme | undefined,
  pos: string,
  detail: string
) {
  return morpheme?.pos === pos && morpheme.posDetail[0] === detail
}

/** Morphemes a verb/adjective head absorbs (食べ|てみました). */
function isInflectionTail(morpheme: Morpheme | undefined): boolean {
  if (!morpheme) return false
  const [detail1] = morpheme.posDetail
  switch (morpheme.pos) {
    case "助動詞":
      return true
    case "助詞":
      return detail1 === "接続助詞" && CONJUNCTIVE_TAILS.has(morpheme.surface)
    case "動詞":
    case "形容詞":
      return detail1 === "非自立" || detail1 === "接尾"
    default:
      return false
  }
}

/** 勉強 + し(ました): IPADIC splits サ変 nouns from する. */
function isSuruCompound(head: Morpheme, next: Morpheme | undefined): boolean {
  return (
    hasDetail(head, "名詞", "サ変接続") &&
    hasDetail(next, "動詞", "自立") &&
    next?.baseForm === "する"
  )
}

/** パン|屋, 田中|さん, 三|人, but not そう in 元気そう (an auxiliary stem). */
function isNounSuffix(morpheme: Morpheme | undefined): boolean {
  return (
    hasDetail(morpheme, "名詞", "接尾") && morpheme?.learnerPos !== "auxiliary"
  )
}

function readWord(morphemes: readonly Morpheme[], start: number): WordDraft {
  let headStart = start
  while (
    morphemes[headStart]?.pos === "接頭詞" &&
    morphemes[headStart + 1]?.pos === "名詞" &&
    morphemes[headStart + 1]?.learnerPos !== "auxiliary"
  ) {
    headStart += 1
  }
  const head = morphemes[headStart]
  if (!head) {
    throw new Error(`No morpheme at index ${headStart}`)
  }

  let headEnd = headStart
  let pos = head.learnerPos
  let baseForm = lemma(head)
  let inflects = head.pos === "動詞" || head.pos === "形容詞"

  if (isSuruCompound(head, morphemes[headStart + 1])) {
    headEnd += 1
    pos = "verb"
    baseForm = `${lemma(head)}する`
    inflects = true
  } else if (head.pos === "名詞" && head.learnerPos !== "auxiliary") {
    if (head.posDetail[0] === "数") {
      while (hasDetail(morphemes[headEnd + 1], "名詞", "数")) headEnd += 1
    }
    while (isNounSuffix(morphemes[headEnd + 1])) headEnd += 1
    baseForm = morphemes
      .slice(start, headEnd + 1)
      .map(lemma)
      .join("")
  } else if (headStart > start) {
    baseForm = morphemes
      .slice(start, headEnd + 1)
      .map(lemma)
      .join("")
  }

  let end = headEnd
  if (inflects) {
    while (isInflectionTail(morphemes[end + 1])) end += 1
  } else if (head.learnerPos === "auxiliary") {
    // でし|た, そう|です: an auxiliary chain reads as one grammar unit.
    while (morphemes[end + 1]?.pos === "助動詞") end += 1
  }

  const morphemeIndexes: number[] = []
  for (let index = start; index <= end; index += 1) morphemeIndexes.push(index)

  return {
    baseForm,
    morphemeIndexes,
    pos,
    tailStart: end > headEnd ? headEnd + 1 : null
  }
}

/**
 * Groups morphemes into learner words. Rules read IPADIC tags; whitespace is
 * kept as morphemes but never becomes a word.
 */
export function buildWordDrafts(morphemes: readonly Morpheme[]): WordDraft[] {
  const drafts: WordDraft[] = []
  let index = 0
  while (index < morphemes.length) {
    const morpheme = morphemes[index]
    if (!morpheme) break
    if (isWhitespaceMorpheme(morpheme)) {
      index += 1
      continue
    }
    if (morpheme.isPunctuation) {
      drafts.push({
        baseForm: morpheme.surface,
        morphemeIndexes: [index],
        pos: morpheme.learnerPos,
        tailStart: null
      })
      index += 1
      continue
    }
    const draft = readWord(morphemes, index)
    drafts.push(draft)
    index = (draft.morphemeIndexes.at(-1) ?? index) + 1
  }
  return drafts
}
