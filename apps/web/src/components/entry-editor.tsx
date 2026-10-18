import { SourceBlockId } from "@folionote/editor-core/extensions"
import {
  CustomCaret,
  CustomLink,
  createSlashCommandExtension,
  createTableKit,
  FoldableHeadings,
  getResolvedDefaultCommands,
  PasteHandler,
  TableCommands,
  useEditorCommands
} from "@folionote/editor-react"
import type { PasteStrategy, SlashCommandItem } from "@folionote/editor-react"
import { CodeBlockShiki } from "@folionote/editor-react/extensions"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import type { JSONContent } from "@tiptap/core"
import { Extension } from "@tiptap/core"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import Placeholder from "@tiptap/extension-placeholder"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { BlockHandle } from "@/components/editor/block-handle"
import { EditorBubbleMenu } from "@/components/editor/editor-bubble-menu"
import { EditorCharacterCount } from "@/components/editor/editor-character-count"
import { JapanesePasteOffer } from "@/components/editor/japanese-paste-offer"
import { JapaneseSentenceBlock } from "@/components/editor/japanese-sentence-block"
import { ResizableImage } from "@/components/editor/resizable-image"
import { HeadingIds } from "@/lib/heading-id-extension"

const EMPTY_COMMANDS: SlashCommandItem[] = []

/**
 * 内容格式类型
 * - json: ProseMirror JSON 格式（推荐）
 * - html: HTML 字符串格式（向后兼容）
 */
type ContentFormat = "json" | "html"

export type ImageUploadHandler = (file: File) => Promise<{ publicUrl: string }>

/**
 * When set, the editor binds its content to the given Yjs doc instead of
 * the `content`/`onChange` prop flow: body content persists exclusively
 * through the collab server's flush (see apps/server/src/collab/server.ts),
 * not through this component's normal save path. `user` drives the local
 * participant's rendered caret/selection color on other clients.
 */
export interface EntryEditorCollabOptions {
  provider: HocuspocusProvider
  user: { name: string; color: string }
}

interface EntryEditorProps {
  /** 初始内容，可以是 JSON 字符串或 HTML。collab 模式下会被忽略——由 Yjs 文档提供内容 */
  content: string
  /** 内容变更回调 */
  onChange?: (content: string, json: string) => void
  /** 内容格式，默认 'json' */
  contentFormat?: ContentFormat
  placeholder?: string
  editable?: boolean
  autoFocus?: boolean
  className?: string
  /** Additional slash commands to include */
  additionalCommands?: SlashCommandItem[]
  /** 粘贴策略：'preserve' 保留富文本结构，'plain' 转换为纯文本 */
  pasteStrategy?: PasteStrategy
  /** Image upload handler for paste/drop */
  onUploadImage?: ImageUploadHandler
  /** Enables real-time collaborative editing for this entry */
  collab?: EntryEditorCollabOptions
}

/**
 * 解析内容字符串为编辑器可用的格式
 */
function parseContent(
  content: string,
  format: ContentFormat
): string | JSONContent {
  if (!content) {
    return ""
  }

  if (format === "json") {
    try {
      return JSON.parse(content) as JSONContent
    } catch {
      // 如果 JSON 解析失败，尝试作为 HTML 处理
      return content
    }
  }

  return content
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml"
])

function handleImageUpload(
  editor: ReturnType<typeof useEditor>,
  uploadFn: ImageUploadHandler,
  file: File,
  t: (key: string) => string
) {
  if (!editor) {
    return
  }

  const toastId = `image-upload-${Date.now()}`
  toast.loading(t("editor.imageUpload.uploading"), { id: toastId })

  uploadFn(file)
    .then(({ publicUrl }) => {
      toast.dismiss(toastId)
      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run()
    })
    .catch((error: unknown) => {
      toast.dismiss(toastId)
      const message = error instanceof Error ? error.message : "Upload failed"
      toast.error(message)
    })
}

function createImageUploadExtension(
  uploadFn: ImageUploadHandler,
  t: (key: string) => string
) {
  return Extension.create({
    name: "imageUpload",

    addProseMirrorPlugins() {
      const { editor } = this
      return [
        new Plugin({
          key: new PluginKey("imageUpload"),
          props: {
            handlePaste(_view, event) {
              const files = [...(event.clipboardData?.files ?? [])]
              const imageFile = files.find((f) => IMAGE_TYPES.has(f.type))
              if (!imageFile) {
                return false
              }

              event.preventDefault()
              handleImageUpload(editor, uploadFn, imageFile, t)
              return true
            },
            handleDrop(_view, event) {
              const files = [...(event.dataTransfer?.files ?? [])]
              const imageFile = files.find((f) => IMAGE_TYPES.has(f.type))
              if (!imageFile) {
                return false
              }

              event.preventDefault()
              handleImageUpload(editor, uploadFn, imageFile, t)
              return true
            }
          }
        })
      ]
    }
  })
}

/**
 * A TipTap-based rich text editor for editing entry content with Markdown shortcuts and debounced auto-save.
 *
 * @param content - Initial content displayed in the editor (JSON string or HTML).
 * @param onChange - Optional callback invoked with the editor's current content after edits (debounced 500ms).
 *                   Returns both HTML and JSON string formats.
 * @param contentFormat - Content format: 'json' (recommended) or 'html' (backward compatible). Defaults to 'json'.
 * @param placeholder - Text shown when the editor is empty; defaults to "Write something...".
 * @param editable - Whether the editor is editable; defaults to `true`.
 * @param autoFocus - If `true`, focuses the editor and places the cursor at the end on mount; defaults to `false`.
 * @param className - Additional CSS classes applied to the editor container.
 * @returns The rendered editor React element.
 */
export function EntryEditor({
  content,
  onChange,
  contentFormat = "json",
  placeholder = "Write something...",
  editable = true,
  autoFocus = false,
  className = "",
  additionalCommands = EMPTY_COMMANDS,
  pasteStrategy = "preserve",
  onUploadImage,
  collab
}: EntryEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  // 跟踪最后一次内部更新的 content，用于避免 setContent 重置 undo 历史
  const lastInternalContentRef = useRef<string | null>(null)

  // Combine default commands with additional commands. The default `table`
  // command carries submenuType "tableGrid", so the slash menu shows an
  // interactive size grid as a flyout (see SlashCommandList).
  const commands = useMemo(() => {
    const defaults = getResolvedDefaultCommands(t)
    return [...defaults, ...additionalCommands]
  }, [additionalCommands, t])

  // Parse initial content based on format
  const initialContent = useMemo(
    () => parseContent(content, contentFormat),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在初始化时解析
    []
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        // Disable the default code block in favor of CodeBlockShiki
        codeBlock: false,
        // Use the hardened CustomLink (noopener, protocol allowlist, openOnClick
        // off) below instead of StarterKit's bundled link, which would otherwise
        // register a duplicate "link" extension.
        link: false,
        // The Collaboration extension below brings its own Yjs-backed undo
        // manager; StarterKit's history would fight it for the same keymap.
        ...(collab ? { undoRedo: false } : {})
      }),
      CodeBlockShiki.configure({
        defaultLanguage: "plaintext"
      }),
      // Stable slug ids on H1-H3 headings so the fumadocs TOC can track the
      // active section (decorations persist through editor re-renders).
      HeadingIds,
      // Collapsible headings — fold content until the next same/higher heading
      FoldableHeadings,
      // Checklists (/checklist or "[ ] " at line start). Keep `nested` in sync
      // with COLLAB_SCHEMA_EXTENSIONS — it changes TaskItem's content model.
      TaskList,
      TaskItem.configure({ nested: true }),
      // Table extensions (+ position-based row/column/block commands)
      ...createTableKit({ t }),
      TableCommands,
      // Link 扩展：支持粘贴 URL 自动转换为链接
      CustomLink,
      // 粘贴处理扩展：处理富文本粘贴策略
      PasteHandler.configure({
        strategy: pasteStrategy
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty"
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-lg max-w-full",
          loading: "lazy"
        }
      }),
      // Mirra-style analyzed sentence (/japanese in the slash menu), and the
      // "turn pasted Japanese into sentences" toast
      JapaneseSentenceBlock,
      ...(editable ? [JapanesePasteOffer.configure({ t })] : []),
      // Keeps imported blocks matchable for Notion pull sync
      SourceBlockId,
      ...(onUploadImage ? [createImageUploadExtension(onUploadImage, t)] : []),
      createSlashCommandExtension({
        commands,
        t
      }),
      CustomCaret.configure({
        enabled: editable
      }),
      // Collaborative entries only: content lives in the Yjs doc instead of
      // the `content` prop, and remote carets/selections render from
      // provider awareness. CustomCaret above is unaffected — it only ever
      // draws the local user's own cursor.
      ...(collab
        ? [
            Collaboration.configure({
              document: collab.provider.document,
              field: "content"
            }),
            CollaborationCaret.configure({
              provider: collab.provider,
              user: collab.user
            })
          ]
        : [])
    ],
    // In collab mode, seeding `content` alongside the Collaboration
    // extension is the classic doubled-document bug on first sync — the Yjs
    // doc (hydrated server-side from entries.contentJson, see
    // apps/server/src/collab/server.ts's onLoadDocument) is the only source
    // of truth once collab is enabled.
    content: collab ? undefined : initialContent,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] transition-colors ${className}`,
        "aria-multiline": "true",
        "aria-placeholder": placeholder,
        spellcheck: "true"
      }
    },
    onUpdate: ({ editor: editorInstance }) => {
      if (onChange) {
        // Debounce the onChange callback for auto-save
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(() => {
          const html = editorInstance.getHTML()
          const json = JSON.stringify(editorInstance.getJSON())
          // 记录这次内部更新的内容，避免 useEffect 调用 setContent
          lastInternalContentRef.current = json
          onChange(html, json)
        }, 500)
      }
    }
  })

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus("end")
    }
  }, [autoFocus, editor])

  // Update content when it changes externally (not from user input)
  // Note: We avoid setContent during user editing to preserve undo history
  useEffect(() => {
    if (!editor) {
      return
    }

    // Collab mode: content is owned by the Yjs doc, not the `content` prop —
    // calling setContent here would fight the Collaboration extension's own
    // sync and can desync local state from the shared doc.
    if (collab) {
      return
    }

    // 如果这次 content 变化是由内部更新触发的，跳过 setContent
    // 这样可以保留 undo 历史
    if (
      contentFormat === "json" &&
      content === lastInternalContentRef.current
    ) {
      lastInternalContentRef.current = null
      return
    }

    // 只有当编辑器没有焦点时才更新内容（避免干扰用户输入和撤销历史）
    // 这是关键：在用户编辑时不要调用 setContent，因为它会清除 undo 历史
    if (editor.isFocused) {
      return
    }

    // 根据格式比较内容
    if (contentFormat === "json") {
      const currentJson = JSON.stringify(editor.getJSON())
      if (content !== currentJson) {
        const parsed = parseContent(content, contentFormat)
        // 使用 emitUpdate: false 避免触发 onUpdate 回调
        // 注意：setContent 会重置历史记录，但由于编辑器没有焦点，这是预期行为
        editor.commands.setContent(parsed, { emitUpdate: false })
      }
    } else if (content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, contentFormat, editor, collab])

  // Cleanup debounce on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    },
    []
  )

  if (!editor) {
    return (
      <div
        aria-busy="true"
        aria-label={t("common.loading")}
        className="animate-pulse space-y-3"
        role="status"
      >
        <div className="h-5 w-4/5 rounded bg-surface-secondary/60" />
        <div className="h-4 w-full rounded bg-surface-secondary/40" />
        <div className="h-4 w-3/4 rounded bg-surface-secondary/40" />
        <div className="h-4 w-1/2 rounded bg-surface-secondary/30" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    )
  }

  return (
    <div className="entry-editor tiptap-caret-container" ref={containerRef}>
      <BlockHandle containerRef={containerRef} editor={editor} />
      {editable && <EditorBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
      {editable && <EditorCharacterCount editor={editor} />}
    </div>
  )
}

/**
 * Provide memoized editor command functions for toolbar controls.
 *
 * @param editor - The TipTap editor instance returned from `useEditor`.
 * @returns An object containing command functions for formatting.
 */
export function useEntryEditorCommands(editor: ReturnType<typeof useEditor>) {
  return useEditorCommands(editor)
}
