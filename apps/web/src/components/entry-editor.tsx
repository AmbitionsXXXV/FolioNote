import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { CodeBlockShiki } from './editor/code-block-extension'
import {
	getDefaultSlashCommands,
	SlashCommand,
	type SlashCommandItem,
} from './editor/slash-command'

type EntryEditorProps = {
	content: string
	onChange?: (content: string) => void
	placeholder?: string
	editable?: boolean
	autoFocus?: boolean
	className?: string
	/** Additional slash commands to include */
	additionalCommands?: SlashCommandItem[]
}

/**
 * A TipTap-based rich text editor for editing entry content with Markdown shortcuts and debounced auto-save.
 *
 * @param content - Initial HTML content displayed in the editor.
 * @param onChange - Optional callback invoked with the editor's current HTML after edits (debounced 500ms).
 * @param placeholder - Text shown when the editor is empty; defaults to "Write something...".
 * @param editable - Whether the editor is editable; defaults to `true`.
 * @param autoFocus - If `true`, focuses the editor and places the cursor at the end on mount; defaults to `false`.
 * @param className - Additional CSS classes applied to the editor container.
 * @returns The rendered editor React element.
 */
export function EntryEditor({
	content,
	onChange,
	placeholder = 'Write something...',
	editable = true,
	autoFocus = false,
	className = '',
	additionalCommands = [],
}: EntryEditorProps) {
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Combine default commands with additional commands
	const commands = useMemo(() => {
		const defaults = getDefaultSlashCommands()
		return [...defaults, ...additionalCommands]
	}, [additionalCommands])

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
			Placeholder.configure({
				placeholder,
				emptyEditorClass: 'is-editor-empty',
			}),
			SlashCommand.configure({
				commands,
			}),
		],
		content,
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
					onChange(editorInstance.getHTML())
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

	// Update content when it changes externally
	useEffect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content)
		}
	}, [content, editor])

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
