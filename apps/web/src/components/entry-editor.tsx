import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CodeBlockShiki } from './editor/code-block-extension'
import { CustomLink } from './editor/link-extension'
import { PasteHandler, type PasteStrategy } from './editor/paste-handler-extension'
import {
	createSlashCommand,
	getDefaultSlashCommands,
	type SlashCommandItem,
} from './editor/slash-command'

/**
 * 内容格式类型
 * - json: ProseMirror JSON 格式（推荐）
 * - html: HTML 字符串格式（向后兼容）
 */
type ContentFormat = 'json' | 'html'

type EntryEditorProps = {
	/** 初始内容，可以是 JSON 字符串或 HTML */
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
}

/**
 * 解析内容字符串为编辑器可用的格式
 */
function parseContent(content: string, format: ContentFormat): string | JSONContent {
	if (!content) {
		return ''
	}

	if (format === 'json') {
		try {
			return JSON.parse(content) as JSONContent
		} catch {
			// 如果 JSON 解析失败，尝试作为 HTML 处理
			return content
		}
	}

	return content
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
	contentFormat = 'json',
	placeholder = 'Write something...',
	editable = true,
	autoFocus = false,
	className = '',
	additionalCommands = [],
	pasteStrategy = 'preserve',
}: EntryEditorProps) {
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const { t } = useTranslation()
	// 跟踪是否是内部更新导致的 content 变化
	const isInternalUpdateRef = useRef(false)

	// Combine default commands with additional commands
	const commands = useMemo(() => {
		const defaults = getDefaultSlashCommands(t)
		return [...defaults, ...additionalCommands]
	}, [additionalCommands])

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
					levels: [1, 2, 3],
				},
				// Disable the default code block in favor of CodeBlockLowlight
				codeBlock: false,
			}),
			CodeBlockShiki.configure({
				defaultLanguage: 'plaintext',
			}),
			// Link 扩展：支持粘贴 URL 自动转换为链接
			CustomLink,
			// 粘贴处理扩展：处理富文本粘贴策略
			PasteHandler.configure({
				strategy: pasteStrategy,
			}),
			Placeholder.configure({
				placeholder,
				emptyEditorClass: 'is-editor-empty',
			}),
			createSlashCommand(t).configure({
				commands,
			}),
		],
		content: initialContent,
		editable,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] ${className}`,
			},
		},
		onUpdate: ({ editor: editorInstance }) => {
			if (onChange) {
				// Debounce the onChange callback for auto-save
				if (debounceRef.current) {
					clearTimeout(debounceRef.current)
				}
				debounceRef.current = setTimeout(() => {
					// 标记为内部更新，避免 useEffect 重复设置内容
					isInternalUpdateRef.current = true
					const html = editorInstance.getHTML()
					const json = JSON.stringify(editorInstance.getJSON())
					onChange(html, json)
				}, 500)
			}
		},
	})

	// Auto-focus when requested
	useEffect(() => {
		if (autoFocus && editor) {
			editor.commands.focus('end')
		}
	}, [autoFocus, editor])

	// Update content when it changes externally (not from user input)
	useEffect(() => {
		if (!editor) {
			return
		}

		// 如果是内部更新导致的变化，跳过 setContent
		if (isInternalUpdateRef.current) {
			isInternalUpdateRef.current = false
			return
		}

		// 只有当编辑器没有焦点时才更新内容（避免干扰用户输入）
		if (editor.isFocused) {
			return
		}

		// 根据格式比较内容
		if (contentFormat === 'json') {
			const currentJson = JSON.stringify(editor.getJSON())
			if (content !== currentJson) {
				const parsed = parseContent(content, contentFormat)
				editor.commands.setContent(parsed)
			}
		} else if (content !== editor.getHTML()) {
			editor.commands.setContent(content)
		}
	}, [content, contentFormat, editor])

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
			<div className="animate-pulse">
				<div className="mb-2 h-4 w-3/4 rounded bg-muted" />
				<div className="h-4 w-1/2 rounded bg-muted" />
			</div>
		)
	}

	return (
		<div className="entry-editor">
			<EditorContent editor={editor} />
		</div>
	)
}

/**
 * Provide memoized editor command functions for toolbar controls.
 *
 * @param editor - The TipTap editor instance returned from `useEditor`.
 * @returns An object containing command functions (`toggleBold`, `toggleItalic`, `toggleHeading`, `toggleBulletList`, `toggleOrderedList`, `toggleBlockquote`, `toggleCode`, `toggleCodeBlock`) that focus the editor and toggle the corresponding formatting, and `isActive(name, attributes?)` which returns `true` if the specified mark or node is currently active, `false` otherwise.
 */
export function useEntryEditorCommands(editor: ReturnType<typeof useEditor>) {
	const toggleBold = useCallback(() => {
		editor?.chain().focus().toggleBold().run()
	}, [editor])

	const toggleItalic = useCallback(() => {
		editor?.chain().focus().toggleItalic().run()
	}, [editor])

	const toggleHeading = useCallback(
		(level: 1 | 2 | 3) => {
			editor?.chain().focus().toggleHeading({ level }).run()
		},
		[editor]
	)

	const toggleBulletList = useCallback(() => {
		editor?.chain().focus().toggleBulletList().run()
	}, [editor])

	const toggleOrderedList = useCallback(() => {
		editor?.chain().focus().toggleOrderedList().run()
	}, [editor])

	const toggleBlockquote = useCallback(() => {
		editor?.chain().focus().toggleBlockquote().run()
	}, [editor])

	const toggleCode = useCallback(() => {
		editor?.chain().focus().toggleCode().run()
	}, [editor])

	const toggleCodeBlock = useCallback(() => {
		editor?.chain().focus().toggleCodeBlock().run()
	}, [editor])

	return {
		toggleBold,
		toggleItalic,
		toggleHeading,
		toggleBulletList,
		toggleOrderedList,
		toggleBlockquote,
		toggleCode,
		toggleCodeBlock,
		isActive: (name: string, attributes?: Record<string, unknown>) =>
			editor?.isActive(name, attributes) ?? false,
	}
}
