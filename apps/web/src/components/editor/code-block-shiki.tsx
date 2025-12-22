import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { codeToHtml } from 'shiki'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'

// Shiki theme that matches FolioNote's design
const SHIKI_THEME = 'github-dark'

// Line threshold for collapsible code blocks
const COLLAPSIBLE_LINE_THRESHOLD = 15

// Number of preview lines to show when collapsed
const PREVIEW_LINES = 10

// Language options for the select dropdown
const LANGUAGE_OPTIONS = [
	{ value: 'plaintext', label: 'Plain Text' },
	{ value: 'javascript', label: 'JavaScript' },
	{ value: 'typescript', label: 'TypeScript' },
	{ value: 'tsx', label: 'TSX' },
	{ value: 'jsx', label: 'JSX' },
	{ value: 'python', label: 'Python' },
	{ value: 'css', label: 'CSS' },
	{ value: 'html', label: 'HTML' },
	{ value: 'json', label: 'JSON' },
	{ value: 'yaml', label: 'YAML' },
	{ value: 'bash', label: 'Bash' },
	{ value: 'shell', label: 'Shell' },
	{ value: 'sql', label: 'SQL' },
	{ value: 'rust', label: 'Rust' },
	{ value: 'go', label: 'Go' },
	{ value: 'java', label: 'Java' },
	{ value: 'c', label: 'C' },
	{ value: 'cpp', label: 'C++' },
	{ value: 'csharp', label: 'C#' },
	{ value: 'php', label: 'PHP' },
	{ value: 'ruby', label: 'Ruby' },
	{ value: 'swift', label: 'Swift' },
	{ value: 'kotlin', label: 'Kotlin' },
	{ value: 'markdown', label: 'Markdown' },
] as const

/**
 * Highlight code using Shiki with fallback to plaintext
 */
async function highlightCode(code: string, lang: string): Promise<string | null> {
	try {
		return await codeToHtml(code, { lang, theme: SHIKI_THEME })
	} catch {
		try {
			return await codeToHtml(code, { lang: 'plaintext', theme: SHIKI_THEME })
		} catch {
			return null
		}
	}
}

/**
 * Custom NodeView component for code blocks with Shiki syntax highlighting
 */
export function CodeBlockShikiView({ node, updateAttributes }: NodeViewProps) {
	const { t } = useTranslation()
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
	const [previewHtml, setPreviewHtml] = useState<string | null>(null)
	const [isCollapsed, setIsCollapsed] = useState(true)
	const language = node.attrs.language || 'plaintext'
	const code = node.textContent

	// Calculate line count and determine if collapsible
	const lineCount = useMemo(() => code.split('\n').length, [code])
	const isCollapsible = lineCount > COLLAPSIBLE_LINE_THRESHOLD

	// Get preview code (first N lines)
	const previewCode = useMemo(() => {
		if (!isCollapsible) return code
		return code.split('\n').slice(0, PREVIEW_LINES).join('\n')
	}, [code, isCollapsible])

	useEffect(() => {
		if (!code) {
			setHighlightedHtml(null)
			setPreviewHtml(null)
			return
		}

		let cancelled = false

		const runHighlight = async () => {
			const html = await highlightCode(code, language)
			if (cancelled) return

			setHighlightedHtml(html)

			// Generate preview HTML for collapsible blocks
			if (isCollapsible && previewCode !== code) {
				const preview = await highlightCode(previewCode, language)
				if (!cancelled) {
					setPreviewHtml(preview)
				}
			}
		}

		runHighlight()

		return () => {
			cancelled = true
		}
	}, [code, language, isCollapsible, previewCode])

	const codeContent = (
		<>
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
				{/* @ts-ignore - NodeViewContent 'as' prop type definition is incompatible with JSX */}
				<NodeViewContent as="code" />
			</pre>
		</>
	)

	return (
		<NodeViewWrapper className="code-block-wrapper">
			<div className="code-block-header">
				{isCollapsible && (
					<button
						className="code-block-collapse-toggle"
						contentEditable={false}
						onClick={() => setIsCollapsed(!isCollapsed)}
						type="button"
					>
						<HugeiconsIcon
							className="code-block-collapse-icon"
							icon={isCollapsed ? ArrowDown01Icon : ArrowUp01Icon}
						/>
						<span className="code-block-line-count">
							{t('editor.codeBlockLines_one', { count: lineCount })}
						</span>
					</button>
				)}
				<div className="code-block-header-spacer" />
				<Select
					defaultValue={language}
					onValueChange={(value) => updateAttributes({ language: value })}
				>
					<SelectTrigger
						className="code-block-language-trigger"
						contentEditable={false}
						size="sm"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{LANGUAGE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isCollapsible ? (
				<div className="code-block-collapsible-container">
					{isCollapsed ? (
						<>
							{/* Preview content - first N lines */}
							{previewHtml ? (
								<div
									className="code-block-highlighted code-block-preview"
									contentEditable={false}
									// biome-ignore lint/security/noDangerouslySetInnerHtml: safe
									dangerouslySetInnerHTML={{ __html: previewHtml }}
								/>
							) : (
								<pre className="code-block-editable code-block-preview">
									<code>{previewCode}</code>
								</pre>
							)}
							{/* Expand button overlay */}
							<div className="code-block-expand-overlay">
								<button
									className="code-block-expand-button"
									contentEditable={false}
									onClick={() => setIsCollapsed(false)}
									type="button"
								>
									<HugeiconsIcon
										className="code-block-expand-icon"
										icon={ArrowDown01Icon}
									/>
									<span>{t('editor.codeBlockShowAll', { count: lineCount })}</span>
								</button>
							</div>
						</>
					) : (
						<>
							{/* Full content */}
							{codeContent}
							{/* Collapse button */}
							<div className="code-block-collapse-overlay">
								<button
									className="code-block-collapse-button"
									contentEditable={false}
									onClick={() => setIsCollapsed(true)}
									type="button"
								>
									<HugeiconsIcon
										className="code-block-collapse-icon"
										icon={ArrowUp01Icon}
									/>
									<span>{t('editor.codeBlockCollapse')}</span>
								</button>
							</div>
						</>
					)}
				</div>
			) : (
				codeContent
			)}
		</NodeViewWrapper>
	)
}
