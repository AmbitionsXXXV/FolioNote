import CodeBlock from '@tiptap/extension-code-block'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeBlockShikiView } from './code-block-shiki'

/**
 * Custom CodeBlock extension that uses Shiki for syntax highlighting
 * This extension wraps the default CodeBlock and adds a custom NodeView
 * that renders highlighted code using Shiki.
 */
export const CodeBlockShiki = CodeBlock.extend({
	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockShikiView)
	},
})
