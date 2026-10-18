// Small kana fuse with the kana before them into one mora (きょ, ファ).
const SMALL_KANA = new Set("ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ")

export interface PitchMora {
  text: string
  high: boolean
  /** Pitch falls right after this mora (the accent nucleus). */
  drop: boolean
}

export function splitMorae(reading: string): string[] {
  const morae: string[] = []
  for (const char of reading) {
    if (SMALL_KANA.has(char) && morae.length > 0) {
      morae[morae.length - 1] += char
    } else {
      morae.push(char)
    }
  }
  return morae
}

/**
 * Tokyo-dialect pitch for a reading and its accent number: 0 is flat (low then
 * high, no fall), 1 starts high and falls at once, n ≥ 2 rises after the first
 * mora and falls after mora n.
 */
export function pitchPattern(reading: string, accent: number): PitchMora[] {
  const morae = splitMorae(reading)
  return morae.map((text, index) => {
    const position = index + 1
    let high: boolean
    if (accent === 0) high = position > 1
    else if (accent === 1) high = position === 1
    else high = position > 1 && position <= accent
    return { text, high, drop: accent > 0 && position === accent }
  })
}

/** ⓪①②… as dictionaries print accent numbers; larger values stay digits. */
export function circledAccent(accent: number): string {
  if (accent === 0) return "⓪"
  if (accent >= 1 && accent <= 20) return String.fromCodePoint(0x24_5f + accent)
  return `[${accent}]`
}
