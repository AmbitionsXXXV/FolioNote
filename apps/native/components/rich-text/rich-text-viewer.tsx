import type { JSONContent } from "@tiptap/core"
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react"
import type { MarkProps, NodeProps } from "@tiptap/static-renderer/json/react"
import { Children, useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native"

interface RichTextViewerProps {
  /** ProseMirror JSON content string */
  content: string
  /** Dark mode */
  isDark?: boolean
}

interface Palette {
  foreground: string
  primary: string
  border: string
  codeBackground: string
  codeForeground: string
}

const DARK_COLORS: Palette = {
  foreground: "#e8e4e1",
  primary: "#a78bfa",
  border: "#3f3f46",
  codeBackground: "#0d1117",
  codeForeground: "#e6edf3"
}

const LIGHT_COLORS: Palette = {
  foreground: "#1f2937",
  primary: "#8b5cf6",
  border: "#e5e7eb",
  codeBackground: "#f3f4f6",
  codeForeground: "#1f2937"
}

const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace"
})

const ALLOWED_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"])
const URL_SCHEME_REGEX = /^([a-z][a-z0-9+.-]*):/i

/** Horizontal padding of the viewer container (matches styles.container). */
const CONTAINER_PADDING = 16
const IMAGE_RADIUS = 12
/**
 * RN has no table layout, so every cell in a column needs the same width to
 * line up across rows: the column's saved width when it was resized on the
 * web, else this default.
 */
const TABLE_COLUMN_WIDTH = 140
const TABLE_CELL_TYPES = new Set(["tableCell", "tableHeader"])

function cellWidth(attrs: Record<string, unknown> | undefined): number {
  const colwidth = attrs?.colwidth
  const saved = Array.isArray(colwidth) ? Number(colwidth[0]) : Number.NaN
  return Number.isFinite(saved) && saved > 0 ? saved : TABLE_COLUMN_WIDTH
}

function openLink(href?: string): void {
  if (!href) {
    return
  }
  // Stored note content is untrusted: only open vetted schemes and reject
  // custom/deep-link schemes (intent://, app schemes) that could trigger
  // unintended native side effects on tap.
  const scheme = URL_SCHEME_REGEX.exec(href.trim())?.[1]?.toLowerCase()
  if (!scheme || !ALLOWED_LINK_SCHEMES.has(scheme)) {
    return
  }
  // Swallow: unsupported/invalid URL schemes shouldn't crash the viewer.
  Linking.openURL(href).catch(() => undefined)
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    container: { padding: CONTAINER_PADDING },
    paragraph: {
      color: c.foreground,
      fontSize: 16,
      lineHeight: 26,
      marginBottom: 12
    },
    paragraphTight: { color: c.foreground, fontSize: 16, lineHeight: 26 },
    h1: {
      color: c.foreground,
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 34,
      marginBottom: 12,
      marginTop: 4
    },
    h2: {
      color: c.foreground,
      fontSize: 22,
      fontWeight: "600",
      lineHeight: 29,
      marginBottom: 10,
      marginTop: 4
    },
    h3: {
      color: c.foreground,
      fontSize: 18,
      fontWeight: "600",
      lineHeight: 25,
      marginBottom: 8,
      marginTop: 4
    },
    list: { marginBottom: 12 },
    listRow: { flexDirection: "row", marginBottom: 4 },
    marker: {
      color: c.foreground,
      fontSize: 16,
      lineHeight: 26,
      marginRight: 8,
      minWidth: 18
    },
    listItemContent: { flex: 1 },
    blockquote: {
      borderLeftColor: c.primary,
      borderLeftWidth: 3,
      marginBottom: 12,
      paddingLeft: 16
    },
    codeBlock: {
      backgroundColor: c.codeBackground,
      borderRadius: 8,
      marginBottom: 12,
      padding: 16
    },
    codeBlockText: {
      color: c.codeForeground,
      fontFamily: MONO_FONT,
      fontSize: 14,
      lineHeight: 21
    },
    inlineCode: {
      backgroundColor: c.codeBackground,
      borderRadius: 4,
      color: c.foreground,
      fontFamily: MONO_FONT,
      fontSize: 14,
      paddingHorizontal: 4
    },
    hr: { backgroundColor: c.border, height: 1, marginVertical: 24 },
    tableScroll: { marginBottom: 12 },
    table: {
      borderColor: c.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden"
    },
    tableRow: { flexDirection: "row" },
    tableCell: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRightWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    tableHeaderCell: { backgroundColor: c.codeBackground },
    tableHeaderText: {
      color: c.foreground,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22
    },
    tableText: { color: c.foreground, fontSize: 15, lineHeight: 22 },
    bold: { fontWeight: "700" },
    italic: { fontStyle: "italic" },
    strike: { textDecorationLine: "line-through" },
    link: { color: c.primary, textDecorationLine: "underline" }
  })
}

type Styles = ReturnType<typeof createStyles>

function paragraphStyle(styles: Styles, parentType: string | undefined) {
  if (parentType === "tableHeader") {
    return styles.tableHeaderText
  }
  if (parentType && TABLE_CELL_TYPES.has(parentType)) {
    return styles.tableText
  }
  return parentType === "listItem" ? styles.paragraphTight : styles.paragraph
}

function headingStyle(styles: Styles, level: number) {
  if (level === 1) {
    return styles.h1
  }
  if (level === 2) {
    return styles.h2
  }
  return styles.h3
}

interface RichTextImageProps {
  src: string
  alt?: string
  /** Width set by the editor's resize handles, in px. Natural size if absent. */
  width?: number
}

/**
 * Read-only image node.
 *
 * React Native images need explicit dimensions, so we fetch the intrinsic size,
 * then render at the editor-stored width (or the natural width), capped to the
 * viewport. `aspectRatio` derives the height so proportions are preserved.
 */
function RichTextImage({ src, alt, width }: RichTextImageProps) {
  const { width: screenWidth } = useWindowDimensions()
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    let active = true
    Image.getSize(
      src,
      (w, h) => {
        if (active && w > 0 && h > 0) {
          setSize({ w, h })
        }
      },
      () => {
        // Broken/unreachable image: leave it unrendered rather than 0-sized.
      }
    )
    return () => {
      active = false
    }
  }, [src])

  if (!size) {
    return null
  }

  const available = screenWidth - CONTAINER_PADDING * 2
  const targetWidth = width && width > 0 ? width : size.w
  const displayWidth = Math.min(targetWidth, available)

  return (
    <Image
      accessibilityLabel={alt || undefined}
      source={{ uri: src }}
      style={{
        width: displayWidth,
        maxWidth: "100%",
        aspectRatio: size.w / size.h,
        borderRadius: IMAGE_RADIUS,
        marginBottom: 12
      }}
    />
  )
}

/**
 * Build a render function that turns ProseMirror JSON into React Native
 * elements. Every node and mark is mapped explicitly — text always lands inside
 * a <Text>, blocks become <View>/<Text>, so no raw strings leak into a <View>.
 */
function buildRenderDoc(styles: Styles) {
  return renderJSONContentToReactElement({
    nodeMapping: {
      doc: ({ children }: NodeProps) => <>{children}</>,
      paragraph: ({ parent, children }: NodeProps) => (
        <Text style={paragraphStyle(styles, parent?.type)}>{children}</Text>
      ),
      heading: ({ node, children }: NodeProps) => (
        <Text style={headingStyle(styles, Number(node?.attrs?.level) || 1)}>
          {children}
        </Text>
      ),
      bulletList: ({ children }: NodeProps) => (
        <View style={styles.list}>
          {Children.map(children as ReactNode, (child) => (
            <View style={styles.listRow}>
              <Text style={styles.marker}>•</Text>
              {child}
            </View>
          ))}
        </View>
      ),
      orderedList: ({ node, children }: NodeProps) => {
        const start = Number(node?.attrs?.start) || 1
        return (
          <View style={styles.list}>
            {Children.map(children as ReactNode, (child, index) => (
              <View style={styles.listRow}>
                <Text style={styles.marker}>{`${start + index}.`}</Text>
                {child}
              </View>
            ))}
          </View>
        )
      },
      listItem: ({ children }: NodeProps) => (
        <View style={styles.listItemContent}>{children}</View>
      ),
      blockquote: ({ children }: NodeProps) => (
        <View style={styles.blockquote}>{children}</View>
      ),
      codeBlock: ({ children }: NodeProps) => (
        <View style={styles.codeBlock}>
          <Text style={styles.codeBlockText}>{children}</Text>
        </View>
      ),
      horizontalRule: () => <View style={styles.hr} />,
      // Wide tables scroll sideways inside the block, like the web editor.
      table: ({ children }: NodeProps) => (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tableScroll}
        >
          <View style={styles.table}>{children}</View>
        </ScrollView>
      ),
      tableRow: ({ children }: NodeProps) => (
        <View style={styles.tableRow}>{children}</View>
      ),
      tableHeader: ({ node, children }: NodeProps) => (
        <View
          style={[
            styles.tableCell,
            styles.tableHeaderCell,
            { width: cellWidth(node?.attrs) }
          ]}
        >
          {children}
        </View>
      ),
      tableCell: ({ node, children }: NodeProps) => (
        <View style={[styles.tableCell, { width: cellWidth(node?.attrs) }]}>
          {children}
        </View>
      ),
      // Analysis needs the server/engine, so native shows the sentence and
      // its translation as text rather than dropping the block.
      japaneseSentence: ({ node }: NodeProps) => {
        const text = node?.attrs?.text as string | undefined
        if (!text) {
          return null
        }
        const translation = node?.attrs?.translation as string | null
        return (
          <View style={styles.blockquote}>
            <Text style={styles.paragraph}>{text}</Text>
            {translation ? (
              <Text style={styles.paragraph}>{translation}</Text>
            ) : null}
          </View>
        )
      },
      image: ({ node }: NodeProps) => {
        const src = node?.attrs?.src as string | undefined
        if (!src) {
          return null
        }
        const widthAttr = Number(node?.attrs?.width)
        return (
          <RichTextImage
            alt={node?.attrs?.alt as string | undefined}
            src={src}
            width={
              Number.isFinite(widthAttr) && widthAttr > 0
                ? widthAttr
                : undefined
            }
          />
        )
      },
      hardBreak: () => "\n",
      text: ({ node }: NodeProps) => node?.text ?? ""
    },
    markMapping: {
      bold: ({ children }: MarkProps) => (
        <Text style={styles.bold}>{children}</Text>
      ),
      italic: ({ children }: MarkProps) => (
        <Text style={styles.italic}>{children}</Text>
      ),
      strike: ({ children }: MarkProps) => (
        <Text style={styles.strike}>{children}</Text>
      ),
      code: ({ children }: MarkProps) => (
        <Text style={styles.inlineCode}>{children}</Text>
      ),
      link: ({ mark, children }: MarkProps) => (
        <Text
          accessibilityRole="link"
          onPress={() => openLink(mark?.attrs?.href)}
          style={styles.link}
        >
          {children}
        </Text>
      )
    },
    unhandledNode: () => null,
    unhandledMark: ({ children }: MarkProps) => <>{children}</>
  })
}

function parseDoc(content: string): JSONContent | null {
  if (!content) {
    return null
  }
  try {
    return JSON.parse(content) as JSONContent
  } catch {
    return null
  }
}

/**
 * Read-only rich text viewer.
 *
 * Renders ProseMirror JSON natively (no WebView / Expo DOM) via Tiptap's static
 * renderer, mapping each node and mark to React Native primitives.
 */
export default function RichTextViewer({
  content,
  isDark = false
}: RichTextViewerProps) {
  const styles = createStyles(isDark ? DARK_COLORS : LIGHT_COLORS)
  const doc = parseDoc(content)
  const body = doc ? buildRenderDoc(styles)({ content: doc }) : null
  return <View style={styles.container}>{body}</View>
}
