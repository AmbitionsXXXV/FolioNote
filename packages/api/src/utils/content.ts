/**
 * 富文本内容转换工具
 *
 * 用于 ProseMirror JSON 与纯文本之间的转换，
 * 支持跨端一致性存储策略
 */

/**
 * ProseMirror 文档节点类型
 */
type ProseMirrorNode = {
	type: string
	content?: ProseMirrorNode[]
	text?: string
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
	attrs?: Record<string, unknown>
}

/**
 * 从 ProseMirror JSON 文档中提取纯文本
 *
 * @param doc - ProseMirror JSON 文档对象或 JSON 字符串
 * @returns 提取的纯文本内容
 */
export function extractTextFromProseMirrorJson(
	doc: ProseMirrorNode | string | null | undefined
): string {
	if (!doc) {
		return ''
	}

	const docObj: ProseMirrorNode =
		typeof doc === 'string' ? (JSON.parse(doc) as ProseMirrorNode) : doc

	return extractTextFromNode(docObj)
}

/**
 * 递归从节点中提取文本
 */
function extractTextFromNode(node: ProseMirrorNode): string {
	// 直接文本节点
	if (node.type === 'text' && node.text) {
		return node.text
	}

	// 没有子节点
	if (!node.content || node.content.length === 0) {
		// 某些节点类型需要添加换行
		if (isBlockNode(node.type)) {
			return '\n'
		}
		return ''
	}

	// 递归处理子节点
	const texts = node.content.map(extractTextFromNode)
	const result = texts.join('')

	// 块级节点后添加换行
	if (isBlockNode(node.type)) {
		return `${result}\n`
	}

	return result
}

/**
 * 判断是否为块级节点
 */
function isBlockNode(type: string): boolean {
	const blockTypes = [
		'paragraph',
		'heading',
		'blockquote',
		'codeBlock',
		'bulletList',
		'orderedList',
		'listItem',
		'horizontalRule',
		'hardBreak',
	]
	return blockTypes.includes(type)
}

/**
 * 从 HTML 字符串中提取纯文本
 *
 * @param html - HTML 字符串
 * @returns 提取的纯文本内容
 */
export function extractTextFromHtml(html: string | null | undefined): string {
	if (!html) {
		return ''
	}

	// 简单的 HTML 标签移除（服务端无 DOM）
	return (
		html
			// 替换块级标签为换行
			.replaceAll(/<\/(p|div|h[1-6]|li|blockquote|pre)>/gi, '\n')
			// 替换 br 为换行
			.replaceAll(/<br\s*\/?>/gi, '\n')
			// 移除所有其他标签
			.replaceAll(/<[^>]*>/g, '')
			// 解码 HTML 实体
			.replaceAll(/&nbsp;/g, ' ')
			.replaceAll(/&amp;/g, '&')
			.replaceAll(/&lt;/g, '<')
			.replaceAll(/&gt;/g, '>')
			.replaceAll(/&quot;/g, '"')
			.replaceAll(/&#39;/g, "'")
			// 清理多余空白
			.replaceAll(/\n{3,}/g, '\n\n')
			.trim()
	)
}

/**
 * 生成内容预览（截断文本）
 *
 * @param text - 纯文本内容
 * @param maxLength - 最大长度，默认 200
 * @returns 截断后的预览文本
 */
export function generateContentPreview(
	text: string | null | undefined,
	maxLength = 200
): string {
	if (!text) {
		return ''
	}

	// 将换行替换为空格以便于预览
	const normalized = text.replaceAll(/\s+/g, ' ').trim()

	if (normalized.length <= maxLength) {
		return normalized
	}

	// 尝试在单词边界截断
	const truncated = normalized.slice(0, maxLength)
	const lastSpace = truncated.lastIndexOf(' ')

	if (lastSpace > maxLength * 0.8) {
		return `${truncated.slice(0, lastSpace)}...`
	}

	return `${truncated}...`
}

/**
 * 验证 ProseMirror JSON 格式是否有效
 *
 * @param json - JSON 字符串或对象
 * @returns 是否为有效的 ProseMirror 文档
 */
export function isValidProseMirrorJson(
	json: string | object | null | undefined
): boolean {
	if (!json) {
		return false
	}

	try {
		const doc = typeof json === 'string' ? JSON.parse(json) : json
		return (
			typeof doc === 'object' && doc !== null && 'type' in doc && doc.type === 'doc'
		)
	} catch {
		return false
	}
}

/**
 * 创建空的 ProseMirror 文档
 *
 * @returns 空文档的 JSON 字符串
 */
export function createEmptyProseMirrorDoc(): string {
	return JSON.stringify({
		type: 'doc',
		content: [
			{
				type: 'paragraph',
			},
		],
	})
}

/**
 * 处理内容更新，同时更新 JSON 和纯文本字段
 *
 * @param contentJson - ProseMirror JSON 内容
 * @returns 包含 contentJson 和 contentText 的对象
 */
export function processContentUpdate(contentJson: string | null | undefined): {
	contentJson: string | null
	contentText: string | null
} {
	if (!contentJson) {
		return { contentJson: null, contentText: null }
	}

	const contentText = extractTextFromProseMirrorJson(contentJson)

	return {
		contentJson,
		contentText: contentText || null,
	}
}
