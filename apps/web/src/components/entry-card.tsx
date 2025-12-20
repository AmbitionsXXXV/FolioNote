import { Delete02Icon, PinIcon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'

type EntryCardProps = {
	id: string
	title: string
	content: string
	isStarred: boolean
	isPinned: boolean
	updatedAt: Date
	onStar?: () => void
	onPin?: () => void
	onDelete?: () => void
}

/**
 * Renders a card representing an entry with title, content preview, and updated date.
 *
 * The card shows pinned/star indicators in the header and reveals action buttons (star, pin, delete)
 * on hover. Action buttons, when provided, prevent navigation and stop event propagation before invoking
 * their callbacks. The content preview is plain-text (HTML stripped) and truncated to 150 characters.
 *
 * @returns A JSX element representing the entry card suitable for use in a list or grid.
 */
export function EntryCard({
	id,
	title,
	content,
	isStarred,
	isPinned,
	updatedAt,
	onStar,
	onPin,
	onDelete,
}: EntryCardProps) {
	// Strip HTML tags for preview
	const plainContent = content.replace(/<[^>]*>/g, '').trim()
	const preview =
		plainContent.slice(0, 150) + (plainContent.length > 150 ? '...' : '')

	// Format date
	const formattedDate = new Intl.DateTimeFormat('zh-CN', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(updatedAt))

	return (
		<Card className="group relative transition-all hover:shadow-md">
			<Link className="block" params={{ id }} to="/entries/$id">
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<h3 className="line-clamp-1 font-semibold text-foreground">
							{title || '无标题'}
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
						{preview || '空白笔记'}
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