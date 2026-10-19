export type WordListFormat = "csv" | "tsv" | "anki"
export type ColumnRole =
  | "headword"
  | "reading"
  | "meaning"
  | "pos"
  | "unit"
  | "ignore"
export interface WordListIssue {
  row: number
  message: string
}

const BOM = /^\uFEFF/
const HTML_TAG = /<[^>]*>/g
const NBSP = /&nbsp;|&#160;|&#xA0;/gi
const ANKI_COMMENT = /^#/m
const KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}ー\s]+$/u
const HAN = /\p{Script=Han}/u
const MEANING =
  /^[\p{Script=Latin}\p{Script=Han}\p{Number}\p{Punctuation}\s]+$/u
const SMALL_INTEGER = /^\d{1,3}$/
const GENERATED_COLUMN = /^Column [A-Z]+$/
const HEADERS: Record<string, ColumnRole> = {
  单词: "headword",
  単語: "headword",
  单語: "headword",
  見出し: "headword",
  word: "headword",
  expression: "headword",
  headword: "headword",
  读音: "reading",
  読み: "reading",
  かな: "reading",
  reading: "reading",
  kana: "reading",
  释义: "meaning",
  意味: "meaning",
  meaning: "meaning",
  meanings: "meaning",
  translation: "meaning",
  中文: "meaning",
  词性: "pos",
  品詞: "pos",
  pos: "pos",
  单元: "unit",
  課: "unit",
  unit: "unit",
  lesson: "unit",
  chapter: "unit"
}

function headerRole(value: string): ColumnRole | undefined {
  return HEADERS[value.trim().toLowerCase()]
}

function columnName(index: number): string {
  let letters = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCodePoint(65 + ((n - 1) % 26)) + letters
  }
  return `Column ${letters}`
}

/** Parse RFC-4180 records; row numbers in issues are one-based logical records. */
function parseRecords(content: string, delimiter: string, comments: boolean) {
  const rows: string[][] = []
  const issues: WordListIssue[] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let closed = false
  const finish = () => {
    row.push(field)
    if (row.some((value) => value.trim())) rows.push(row)
    row = []
    field = ""
    closed = false
  }
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (
      comments &&
      !quoted &&
      row.length === 0 &&
      field === "" &&
      char === "#"
    ) {
      while (i < content.length && content[i] !== "\n") i++
      continue
    }
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
        closed = true
      } else {
        field += char
      }
    } else if (char === delimiter) {
      row.push(field)
      field = ""
      closed = false
    } else if (char === "\n" || char === "\r") {
      finish()
      if (char === "\r" && content[i + 1] === "\n") i++
    } else if (char === '"' && !field && !closed) {
      quoted = true
    } else {
      if (closed || char === '"') {
        issues.push({
          row: rows.length + 1,
          message: "Unexpected character outside quoted field"
        })
        closed = false
      }
      field += char
    }
  }
  if (quoted)
    issues.push({ row: rows.length + 1, message: "Unclosed quoted field" })
  if (field || row.length) finish()
  return { rows, issues }
}

export function parseWordList(
  content: string,
  options: { format?: WordListFormat } = {}
) {
  const clean = content.replace(BOM, "")
  const format =
    options.format ??
    (ANKI_COMMENT.test(clean) ? "anki" : detectDelimitedFormat(clean))
  const parsed = parseRecords(
    clean,
    format === "csv" ? "," : "\t",
    format === "anki"
  )
  const records =
    format === "anki"
      ? parsed.rows.map((row) =>
          row.map((value) =>
            value.replace(HTML_TAG, "").replace(NBSP, " ").trim()
          )
        )
      : parsed.rows
  const first = records[0] ?? []
  const hasHeader = first.some((value) => headerRole(value) !== undefined)
  const rows = hasHeader ? records.slice(1) : records
  const width = first.length
  const columns = hasHeader
    ? first.map((value) => value.trim())
    : first.map((_, i) => columnName(i))
  for (const [index, row] of rows.entries()) {
    if (row.length !== width)
      parsed.issues.push({
        row: index + (hasHeader ? 2 : 1),
        message: `Expected ${width} columns, received ${row.length}`
      })
  }
  return { format, hasHeader, columns, rows, issues: parsed.issues }
}

function detectDelimitedFormat(content: string): "csv" | "tsv" {
  let quoted = false
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (char === '"') {
      if (quoted && content[i + 1] === '"') i++
      else quoted = !quoted
    } else if (!quoted) {
      if (char === "\t") return "tsv"
      if (char === "," || char === "\n" || char === "\r") return "csv"
    }
  }
  return "csv"
}

export function guessColumnRoles(
  columns: string[],
  rows: string[][]
): ColumnRole[] {
  const hasHeaders = columns.some((name) => !GENERATED_COLUMN.test(name))
  if (hasHeaders) return columns.map((name) => headerRole(name) ?? "ignore")
  let headwordFound = false
  return columns.map((_, index) => {
    const values = rows
      .slice(0, 100)
      .map((row) => row[index]?.trim() ?? "")
      .filter(Boolean)
    if (values.length === 0) return "ignore"
    const mostly = (predicate: (value: string) => boolean) =>
      values.filter(predicate).length / values.length >= 0.7
    if (mostly((value) => SMALL_INTEGER.test(value))) return "unit"
    if (mostly((value) => KANA.test(value))) return "reading"
    if (
      !headwordFound &&
      mostly((value) => HAN.test(value) && value.length <= 12)
    ) {
      headwordFound = true
      return "headword"
    }
    if (mostly((value) => MEANING.test(value))) return "meaning"
    return "ignore"
  })
}
