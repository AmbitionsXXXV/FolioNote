import type { ColumnRole } from "@folionote/japanese"

export { htmlToJapaneseText as htmlToArticleText } from "@folionote/japanese"

/** Matches japanese.lexicons.import's row schema and cap. */
export const LEXICON_ROW_LIMIT = 5000

export interface LexiconImportRow {
  headword: string
  reading?: string
  meanings?: string[]
  pos?: string
  unit?: string
}

export type MeaningLanguage = "zh" | "en" | "ja"
export type LexiconKind = "book" | "deck"
export type LexiconLevel = "N5" | "N4" | "N3" | "N2" | "N1"
export const LEXICON_LEVELS: LexiconLevel[] = ["N5", "N4", "N3", "N2", "N1"]

/** Word lists write several meanings into one cell: 吃；进食 / eat; consume. */
const MEANING_SEPARATOR = /[；;、/]/
const FILE_EXTENSION = /\.[^.]+$/

export function splitMeanings(value: string): string[] {
  return value
    .split(MEANING_SEPARATOR)
    .map((meaning) => meaning.trim())
    .filter(Boolean)
}

export function headwordColumnCount(roles: readonly ColumnRole[]): number {
  return roles.filter((role) => role === "headword").length
}

const firstValue = (
  roles: readonly ColumnRole[],
  row: readonly string[],
  role: ColumnRole
): string | undefined => {
  for (const [index, candidate] of roles.entries()) {
    const value = row[index]?.trim()
    if (candidate === role && value) return value
  }
  return undefined
}

/**
 * Turns parsed cells plus the user's column roles into import rows. Row order
 * and count are preserved (capped at the server limit) so validation results
 * map back to table rows by index; an empty headword is reported server-side.
 */
export function buildLexiconRows(
  roles: readonly ColumnRole[],
  rows: readonly (readonly string[])[]
): LexiconImportRow[] {
  const result: LexiconImportRow[] = []
  for (const row of rows.slice(0, LEXICON_ROW_LIMIT)) {
    const meanings: string[] = []
    for (const [index, role] of roles.entries()) {
      if (role === "meaning") {
        meanings.push(...splitMeanings(row[index] ?? ""))
      }
    }
    result.push({
      headword: firstValue(roles, row, "headword") ?? "",
      reading: firstValue(roles, row, "reading"),
      meanings: meanings.length > 0 ? [...new Set(meanings)] : undefined,
      pos: firstValue(roles, row, "pos"),
      unit: firstValue(roles, row, "unit")
    })
  }
  return result
}

export function defaultListName(fileName: string): string {
  return fileName.replace(FILE_EXTENSION, "").trim() || fileName
}

export function meaningLanguageFor(uiLanguage: string): MeaningLanguage {
  if (uiLanguage.startsWith("zh")) return "zh"
  if (uiLanguage.startsWith("ja")) return "ja"
  return "en"
}
