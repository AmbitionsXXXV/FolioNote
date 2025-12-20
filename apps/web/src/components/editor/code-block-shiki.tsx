'use client'

import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'

// Shiki theme that matches FolioNote's design
const SHIKI_THEME = 'github-dark'

/**
 * Custom NodeView component for code blocks with Shiki syntax highlighting
 */
export function CodeBlockShikiView({ node, updateAttributes }: NodeViewProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
	const language = node.attrs.language || 'plaintext'
	const code = node.textContent

	useEffect(() => {
		if (!code) {
			setHighlightedHtml(null)
			return
		}

		let cancelled = false

		const highlight = async () => {
			try {
				const html = await codeToHtml(code, {
					lang: language,
					theme: SHIKI_THEME,
				})
				if (!cancelled) {
					setHighlightedHtml(html)
				}
			} catch {
				// If language is not supported, fallback to plaintext
				if (!cancelled) {
					try {
						const html = await codeToHtml(code, {
							lang: 'plaintext',
							theme: SHIKI_THEME,
						})
						setHighlightedHtml(html)
					} catch {
						setHighlightedHtml(null)
					}
				}
			}
		}

		highlight()

		return () => {
			cancelled = true
		}
	}, [code, language])

	return (
		<NodeViewWrapper className="code-block-wrapper">
			<div className="code-block-header">
				<select
					className="code-block-language-select"
					contentEditable={false}
					onChange={(e) => updateAttributes({ language: e.target.value })}
					value={language}
				>
					<option value="plaintext">Plain Text</option>
					<option value="javascript">JavaScript</option>
					<option value="typescript">TypeScript</option>
					<option value="tsx">TSX</option>
					<option value="jsx">JSX</option>
					<option value="python">Python</option>
					<option value="css">CSS</option>
					<option value="html">HTML</option>
					<option value="json">JSON</option>
					<option value="yaml">YAML</option>
					<option value="bash">Bash</option>
					<option value="shell">Shell</option>
					<option value="sql">SQL</option>
					<option value="rust">Rust</option>
					<option value="go">Go</option>
					<option value="java">Java</option>
					<option value="c">C</option>
					<option value="cpp">C++</option>
					<option value="csharp">C#</option>
					<option value="php">PHP</option>
					<option value="ruby">Ruby</option>
					<option value="swift">Swift</option>
					<option value="kotlin">Kotlin</option>
					<option value="markdown">Markdown</option>
				</select>
			</div>
			{highlightedHtml ? (
				<div
					className="code-block-highlighted"
					contentEditable={false}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: safe
					dangerouslySetInnerHTML={{ __html: highlightedHtml }}
				/>
			) : null}
			<pre
				className={
					highlightedHtml ? 'code-block-editable hidden' : 'code-block-editable'
				}
			>
				{/* @ts-ignore */}
				<NodeViewContent as="code" />
			</pre>
		</NodeViewWrapper>
	)
}
