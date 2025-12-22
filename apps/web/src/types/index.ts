export type ReviewRule = 'due' | 'new' | 'starred' | 'unreviewed' | 'all'
export type Rating = 'again' | 'hard' | 'good' | 'easy'
export type SnoozePreset = 'tomorrow' | '3days' | '7days' | 'custom'

export type Entry = {
	id: string
	title: string
	/** ProseMirror JSON 格式内容 */
	contentJson?: string | null
	/** 纯文本内容，用于预览和搜索 */
	contentText?: string | null
	isStarred: boolean
	isPinned: boolean
	isInbox: boolean
	updatedAt: string | number | Date
	createdAt: string | number | Date
}
