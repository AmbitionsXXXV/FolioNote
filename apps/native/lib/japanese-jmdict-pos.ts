/**
 * JMdict part-of-speech codes that have a readable label under
 * `japanese.word.pos.*`. Any other code is shown raw.
 */
const LABELLED_CODES = new Set([
  "v1",
  "v5",
  "vs",
  "vk",
  "vt",
  "vi",
  "n",
  "adj-i",
  "adj-na",
  "adj-no",
  "adv",
  "adv-to",
  "exp",
  "pn",
  "prt",
  "conj",
  "int",
  "aux-v",
  "n-adv",
  "n-t",
  "ctr",
  "num",
  "pref",
  "suf"
])

const GODAN_PREFIX = /^v5/

/**
 * Returns the i18n key for a JMdict POS code, or null when the code has no
 * label. Godan variants (v5r, v5k-s, …) collapse onto the shared v5 label.
 */
export function jmdictPosLabelKey(code: string): string | null {
  const normalized = GODAN_PREFIX.test(code) ? "v5" : code
  return LABELLED_CODES.has(normalized)
    ? `japanese.word.pos.${normalized}`
    : null
}
