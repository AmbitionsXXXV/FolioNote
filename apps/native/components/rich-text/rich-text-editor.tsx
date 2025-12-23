'use dom'

import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from 'heroui-native'
import { useCallback, useEffect, useRef } from 'react'

type RichTextEditorProps = {
	dom?: import('expo/dom').DOMProps
	/** ProseMirror JSON content string */
	content: string
	/** Placeholder text */
	placeholder?: string
	/** Dark mode */
	isDark?: boolean
	/** Whether the editor is editable */
	editable?: boolean
	/** Auto focus on mount */
	autoFocus?: boolean
	/** Called when content changes (throttled) - returns JSON string */
	onChange?: (json: string, text: string) => Promise<void>
	/** Called when save is requested */
	onSave?: () => Promise<void>
}

/**
 * Rich text editor component using Tiptap.
 * Embedded in a WebView via Expo DOM Components.
 * Implements RN ↔ WebView message bridging.
 */
export default function RichTextEditor({
	content,
	placeholder = 'Write something...',
	isDark = false,
	editable = true,
	autoFocus = false,
	onChange,
	onSave,
}: RichTextEditorProps) {
	const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isInternalUpdateRef = useRef(false)

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
			Placeholder.configure({
				placeholder,
				emptyEditorClass: 'is-editor-empty',
			}),
		],
		content: parseContent(content),
		editable,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: 'prose-editor',
			},
		},
		onUpdate: ({ editor: editorInstance }) => {
			if (onChange) {
				// Throttle onChange callback
				if (throttleRef.current) {
					clearTimeout(throttleRef.current)
				}
				throttleRef.current = setTimeout(() => {
					isInternalUpdateRef.current = true
					const json = JSON.stringify(editorInstance.getJSON())
					const text = editorInstance.getText()
					onChange(json, text)
				}, 300)
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
		if (!editor) {
			return
		}

		// Skip if this is an internal update
		if (isInternalUpdateRef.current) {
			isInternalUpdateRef.current = false
			return
		}

		// Only update when editor is not focused
		if (editor.isFocused) {
			return
		}

		const currentJson = JSON.stringify(editor.getJSON())
		if (content !== currentJson) {
			const parsed = parseContent(content)
			editor.commands.setContent(parsed)
		}
	}, [content, editor])

	// Cleanup throttle on unmount
	useEffect(
		() => () => {
			if (throttleRef.current) {
				clearTimeout(throttleRef.current)
			}
		},
		[]
	)

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			// Cmd/Ctrl + S to save
			if ((event.metaKey || event.ctrlKey) && event.key === 's') {
				event.preventDefault()
				onSave?.()
			}
		},
		[onSave]
	)

	return (
		<div className={cn('rich-text-editor', isDark ? 'dark' : '')}>
			<style>{getStyles(isDark)}</style>
			<EditorContent editor={editor} onKeyDown={handleKeyDown} />
		</div>
	)
}

/**
 * Parse content string to JSONContent
 */
function parseContent(content: string): string | JSONContent {
	if (!content) {
		return ''
	}

	try {
		return JSON.parse(content) as JSONContent
	} catch {
		// If JSON parse fails, treat as HTML
		return content
	}
}

/**
 * Get CSS styles for the editor
 */
function getStyles(isDark: boolean): string {
	const colors = isDark
		? {
				background: '#1a1614',
				foreground: '#e8e4e1',
				muted: '#a3a3a3',
				mutedForeground: '#9ca3af',
				primary: '#a78bfa',
				border: '#3f3f46',
				codeBackground: '#0d1117',
				selection: 'rgba(167, 139, 250, 0.3)',
			}
		: {
				background: '#ffffff',
				foreground: '#1f2937',
				muted: '#f3f4f6',
				mutedForeground: '#6b7280',
				primary: '#8b5cf6',
				border: '#e5e7eb',
				codeBackground: '#f3f4f6',
				selection: 'rgba(139, 92, 246, 0.2)',
			}

	return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background: ${colors.background};
      color: ${colors.foreground};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      height: 100%;
    }

    .rich-text-editor {
      padding: 16px;
      min-height: 100%;
    }

    .prose-editor {
      outline: none;
      min-height: 200px;
    }

    /* Placeholder */
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${colors.mutedForeground};
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }

    /* Selection */
    .ProseMirror ::selection {
      background: ${colors.selection};
    }

    .ProseMirror h1 {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 0.75rem;
      color: ${colors.foreground};
    }

    .ProseMirror h2 {
      font-size: 1.375rem;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 0.625rem;
      color: ${colors.foreground};
    }

    .ProseMirror h3 {
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      color: ${colors.foreground};
    }

    .ProseMirror p {
      margin-bottom: 0.75rem;
      color: ${colors.foreground};
    }

    .ProseMirror ul,
    .ProseMirror ol {
      margin-bottom: 0.75rem;
      padding-left: 1.5rem;
    }

    .ProseMirror ul {
      list-style-type: disc;
    }

    .ProseMirror ol {
      list-style-type: decimal;
    }

    .ProseMirror li {
      margin-bottom: 0.25rem;
    }

    .ProseMirror blockquote {
      border-left: 3px solid ${colors.primary};
      margin-bottom: 0.75rem;
      padding-left: 1rem;
      color: ${colors.mutedForeground};
      font-style: italic;
    }

    .ProseMirror code {
      background-color: ${colors.muted};
      border-radius: 0.25rem;
      padding: 0.125rem 0.375rem;
      font-family: 'SF Mono', Menlo, Monaco, monospace;
      font-size: 0.875em;
    }

    .ProseMirror pre {
      background-color: ${colors.codeBackground};
      border-radius: 0.5rem;
      margin-bottom: 0.75rem;
      overflow-x: auto;
      padding: 1rem;
    }

    .ProseMirror pre code {
      background: none;
      padding: 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: ${isDark ? '#e6edf3' : colors.foreground};
    }

    .ProseMirror hr {
      border: none;
      border-top: 1px solid ${colors.border};
      margin: 1.5rem 0;
    }

    .ProseMirror strong {
      font-weight: 700;
    }

    .ProseMirror em {
      font-style: italic;
    }

    .ProseMirror a {
      color: ${colors.primary};
      text-decoration: underline;
    }

    .ProseMirror a:active {
      opacity: 0.7;
    }

    /* iOS-specific optimizations */
    @supports (-webkit-touch-callout: none) {
      .ProseMirror {
        -webkit-user-select: text;
        user-select: text;
      }

      /* Prevent zoom on double-tap */
      * {
        touch-action: manipulation;
      }
    }
  `
}
