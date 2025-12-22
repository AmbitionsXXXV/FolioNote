import type { SupportedLanguage } from '@folio/locales'
import {
	Clock01Icon,
	InboxIcon,
	RefreshIcon,
	StarIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import type { ReviewRule } from '@/types'

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
	'en-US': 'English',
	'zh-CN': '简体中文',
	'ja-JP': '日本語',
}

export const REVIEW_RULES: {
	key: ReviewRule
	labelKey: string
	icon: IconSvgElement
	descriptionKey: string
}[] = [
	{
		key: 'due',
		labelKey: 'review.dueEntries',
		icon: Clock01Icon,
		descriptionKey: 'review.dueEntriesDescription',
	},
	{
		key: 'new',
		labelKey: 'review.newEntries',
		icon: InboxIcon,
		descriptionKey: 'review.newEntriesDescription',
	},
	{
		key: 'starred',
		labelKey: 'review.starredEntries',
		icon: StarIcon,
		descriptionKey: 'review.starredEntriesDescription',
	},
	{
		key: 'unreviewed',
		labelKey: 'review.unreviewedEntries',
		icon: ViewIcon,
		descriptionKey: 'review.unreviewedEntriesDescription',
	},
	{
		key: 'all',
		labelKey: 'review.allEntries',
		icon: RefreshIcon,
		descriptionKey: 'review.allEntriesDescription',
	},
]
