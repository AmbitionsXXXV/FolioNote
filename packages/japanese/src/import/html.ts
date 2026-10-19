import { Parser } from "htmlparser2"

const BLOCK_TAGS = new Set(
  "p div br li h1 h2 h3 h4 h5 h6 tr section article blockquote pre hr dd dt table ul ol header footer main nav aside figure figcaption".split(
    " "
  )
)
const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "rt",
  "rp"
])
const BLANK_LINES = /\n{3,}/g
const LINE_SPACE = /[^\S\n]+/g
const CHARSET = /\bcharset\s*=\s*["']?\s*([^\s;"'/>]+)/i

const cleanText = (text: string): string =>
  text
    .replace(LINE_SPACE, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(BLANK_LINES, "\n\n")
    .trim()

/** DOM-free HTML extraction shared by URL and local file imports. */
export function htmlToJapaneseText(html: string): {
  title: string | null
  text: string
} {
  const body: string[] = []
  const title: string[] = []
  const heading: string[] = []
  let skipDepth = 0
  let inTitle = false
  let inHeading = false
  let hasHeading = false
  let inHead = false
  const parser = new Parser(
    {
      onopentag(name) {
        if (SKIP_TAGS.has(name)) skipDepth += 1
        if (skipDepth) return
        if (name === "head") inHead = true
        if (name === "title") inTitle = true
        if (name === "h1" && !hasHeading) {
          inHeading = true
          hasHeading = true
        }
        if (BLOCK_TAGS.has(name)) body.push("\n")
      },
      ontext(text) {
        if (skipDepth) return
        if (inTitle) title.push(text)
        else if (!inHead) body.push(text)
        if (inHeading) heading.push(text)
      },
      onclosetag(name) {
        if (SKIP_TAGS.has(name)) {
          skipDepth -= 1
          return
        }
        if (skipDepth) return
        if (name === "head") inHead = false
        if (name === "title") inTitle = false
        if (name === "h1") inHeading = false
        if (BLOCK_TAGS.has(name) && name !== "br" && name !== "hr")
          body.push("\n")
      }
    },
    { decodeEntities: true }
  )
  parser.end(html)
  return {
    title: cleanText(title.join("")) || cleanText(heading.join("")) || null,
    text: cleanText(body.join(""))
  }
}

/** Header, HTML declaration, BOM, then UTF-8; no platform-specific imports. */
export function decodeJapaneseBytes(
  bytes: ArrayBuffer | Uint8Array,
  contentTypeHeader?: string | null
): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let label = CHARSET.exec(contentTypeHeader ?? "")?.[1]
  if (!label) {
    const prefix = Array.from(data.subarray(0, 2048), (byte) =>
      String.fromCodePoint(byte < 128 ? byte : 32)
    ).join("")
    const parser = new Parser({
      onopentag(name, attrs) {
        if (name !== "meta" || label) return
        label =
          attrs.charset ||
          (attrs["http-equiv"]?.toLowerCase() === "content-type"
            ? CHARSET.exec(attrs.content ?? "")?.[1]
            : undefined)
      }
    })
    parser.end(prefix)
  }
  if (!label) {
    if (data[0] === 0xff && data[1] === 0xfe) label = "utf-16le"
    else if (data[0] === 0xfe && data[1] === 0xff) label = "utf-16be"
    else label = "utf-8"
  }
  try {
    return new TextDecoder(label).decode(data)
  } catch {
    return new TextDecoder("utf-8").decode(data)
  }
}
