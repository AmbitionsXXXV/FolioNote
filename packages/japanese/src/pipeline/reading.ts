import { toHiragana, toRomaji } from "wanakana"

import type { RawMorpheme } from "../engine"
import type { RubySegment } from "../types"

// ヵ/ヶ are katakana codepoints but read like counters (一ヶ月 → いっかげつ),
// so they align as kanji, not as literal kana anchors.
const KANJI_LIKE = /[\p{Script=Han}々〆ヵヶ]/u
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u
const REGEX_META = /[.*+?^${}()|[\]\\]/g

// Hepburn writes these particles by sound, not by kana (は → wa).
const PARTICLE_ROMAJI: Record<string, string> = { は: "wa", へ: "e", を: "o" }

/** Keeps ー so コーヒー stays こーひー instead of こうひい. */
export function toHiraganaReading(katakana: string): string {
  return toHiragana(katakana, { convertLongVowelMark: false })
}

/** Readings the pipeline can trust: present and pure kana. */
export function usableReading(morpheme: RawMorpheme): string | null {
  const { reading } = morpheme
  if (reading === null || !KANA_ONLY.test(reading)) return null
  return reading
}

export function kanaToRomaji(kana: string): string {
  return toRomaji(kana)
}

export function morphemeRomaji(morpheme: RawMorpheme): string | null {
  const reading = usableReading(morpheme)
  if (reading === null) return null
  if (morpheme.pos === "助詞") {
    const override = PARTICLE_ROMAJI[morpheme.surface]
    if (override !== undefined) return override
  }
  return kanaToRomaji(reading)
}

interface Run {
  text: string
  isKana: boolean
}

function splitRuns(surface: string): Run[] {
  const runs: Run[] = []
  for (const char of surface) {
    const isKana = KANA.test(char) && !KANJI_LIKE.test(char)
    const last = runs.at(-1)
    if (last && last.isKana === isKana) {
      last.text += char
    } else {
      runs.push({ text: char, isKana })
    }
  }
  return runs
}

function matchRuns(runs: Run[], reading: string, lazy: boolean) {
  const group = lazy ? "(.+?)" : "(.+)"
  const pattern = runs
    .map((run) =>
      run.isKana
        ? toHiraganaReading(run.text).replace(REGEX_META, "\\$&")
        : group
    )
    .join("")
  const match = new RegExp(`^${pattern}$`, "u").exec(reading)
  return match ? match.slice(1) : null
}

/**
 * Aligns a hiragana reading onto the surface: kana runs are literal anchors,
 * each kanji run takes the reading between anchors (新しい → 新/あたら + しい).
 * When anchors cannot place the reading unambiguously the whole surface gets
 * one ruby (昨日 → きのう), which is never wrong, only coarser.
 */
export function alignRuby(
  surface: string,
  hiraganaReading: string
): RubySegment[] | null {
  if (!KANJI_LIKE.test(surface)) return null
  const whole: RubySegment[] = [{ text: surface, reading: hiraganaReading }]
  const runs = splitRuns(surface)
  if (runs.length === 1) return whole

  const lazy = matchRuns(runs, hiraganaReading, true)
  const greedy = matchRuns(runs, hiraganaReading, false)
  if (
    lazy === null ||
    greedy === null ||
    lazy.some((value, index) => value !== greedy[index])
  ) {
    return whole
  }

  let groupIndex = 0
  return runs.map((run) => {
    if (run.isKana) return { text: run.text }
    const reading = lazy[groupIndex] ?? ""
    groupIndex += 1
    return { text: run.text, reading }
  })
}

export function morphemeRuby(morpheme: RawMorpheme): RubySegment[] | null {
  const reading = usableReading(morpheme)
  if (reading === null) return null
  return alignRuby(morpheme.surface, toHiraganaReading(reading))
}

/** Concatenates morpheme rubies; adjacent plain segments merge. */
export function joinRuby(
  parts: { surface: string; ruby: RubySegment[] | null }[]
): RubySegment[] | null {
  const segments: RubySegment[] = []
  let hasReading = false
  for (const part of parts) {
    const pieces = part.ruby ?? [{ text: part.surface }]
    for (const piece of pieces) {
      const last = segments.at(-1)
      if (piece.reading === undefined && last && last.reading === undefined) {
        last.text += piece.text
        continue
      }
      if (piece.reading !== undefined) hasReading = true
      segments.push({ ...piece })
    }
  }
  return hasReading ? segments : null
}
