'use dom'

import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from 'heroui-native'
import { useEffect } from 'react'

type RichTextViewerProps = {
	dom?: import('expo/dom').DOMProps
	/** ProseMirror JSON content string */
	content: string
	/** Dark mode */
	isDark?: boolean
}

/**
 * Rich text viewer component using Tiptap in read-only mode.
 * Renders ProseMirror JSON content in a WebView.
 */
export default function RichTextViewer({
	content,
	isDark = false,
}: RichTextViewerProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
		],
		content: parseContent(content),
		editable: false,
		immediatelyRender: false,
	})

	// Update content when it changes
	useEffect(() => {
		if (editor && content) {
			const parsed = parseContent(content)
			editor.commands.setContent(parsed)
		}
	}, [content, editor])

	return (
		<div className={cn('rich-text-viewer', isDark ? 'dark' : '')}>
			<style>{getStyles(isDark)}</style>
			<EditorContent editor={editor} />
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
 * Get CSS styles for the viewer
 */
function getStyles(isDark: boolean): string {
	const colors = isDark
		? {
				background: '#1a1614',
				foreground: '#e8e4e1',
				muted: '#a3a3a3',
				primary: '#a78bfa',
				border: '#3f3f46',
				codeBackground: '#0d1117',
			}
		: {
				background: '#ffffff',
				foreground: '#1f2937',
				muted: '#6b7280',
				primary: '#8b5cf6',
				border: '#e5e7eb',
				codeBackground: '#f3f4f6',
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
    }

    .rich-text-viewer {
      padding: 16px;
    }

    .ProseMirror {
      outline: none;
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
      color: ${colors.muted};
      font-style: italic;
    }

    .ProseMirror code {
      background-color: ${colors.codeBackground};
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
  `
}
