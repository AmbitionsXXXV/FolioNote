import { Delete02Icon, PinIcon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'

type EntryCardProps = {
	id: string
	title: string
	/** @deprecated 使用 contentText 替代 */
	content: string
	/** 纯文本内容，用于预览（优先使用） */
	contentText?: string | null
	isStarred: boolean
	isPinned: boolean
	updatedAt: string | number | Date
	onStar?: () => void
	onPin?: () => void
	onDelete?: () => void
}

/**
 * Render an entry card showing title, plain-text content preview, updated date, and optional action buttons for star, pin, and delete.
 *
 * The preview strips HTML and is truncated to 150 characters. Action buttons, when provided, prevent navigation and stop event propagation before invoking their callbacks.
 *
 * @returns A JSX element representing the entry card
 */
export function EntryCard({
	id,
	title,
	content,
	contentText,
	isStarred,
	isPinned,
	updatedAt,
	onStar,
	onPin,
	onDelete,
}: EntryCardProps) {
	const { t } = useTranslation()
	// 优先使用 contentText，向后兼容从 HTML 提取
	const plainContent = contentText ?? content.replace(/<[^>]*>/g, '').trim()
	const preview =
		plainContent.slice(0, 150) + (plainContent.length > 150 ? '...' : '')

	// Normalize date to Date object
	const date = new Date(updatedAt)

	// Format date
	const formattedDate = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date)

	return (
		<Card className="group relative transition-all hover:shadow-md">
			<Link className="block" params={{ id }} to="/entries/$id">
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<h3 className="line-clamp-1 font-semibold text-foreground">
							{title || t('entryCard.untitled')}
						</h3>
						<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							{isPinned ? (
								<HugeiconsIcon
									className="size-4 fill-primary text-primary"
									icon={PinIcon}
								/>
							) : null}
							{isStarred ? (
								<HugeiconsIcon
									className="size-4 fill-amber-500 text-amber-500"
									icon={StarIcon}
								/>
							) : null}
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="mb-3 line-clamp-2 text-muted-foreground text-sm">
						{preview || t('entryCard.emptyNote')}
					</p>
					<p className="text-muted-foreground text-xs">{formattedDate}</p>
				</CardContent>
			</Link>

			{/* Action buttons - shown on hover */}
			<div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
				{onStar ? (
					<Button
						className="h-8 w-8"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onStar()
						}}
						size="icon"
						variant="ghost"
					>
						<HugeiconsIcon
							className={cn(
								'size-4',
								isStarred ? 'fill-amber-500 text-amber-500' : ''
							)}
							icon={StarIcon}
						/>
					</Button>
				) : null}
				{onPin ? (
					<Button
						className="h-8 w-8"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onPin()
						}}
						size="icon"
						variant="ghost"
					>
						<HugeiconsIcon
							className={cn('size-4', isPinned ? 'fill-primary text-primary' : '')}
							icon={PinIcon}
						/>
					</Button>
				) : null}
				{onDelete ? (
					<Button
						className="h-8 w-8 text-destructive hover:text-destructive"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onDelete()
						}}
						size="icon"
						variant="ghost"
					>
						<HugeiconsIcon className="size-4" icon={Delete02Icon} />
					</Button>
				) : null}
			</div>
		</Card>
	)
}
