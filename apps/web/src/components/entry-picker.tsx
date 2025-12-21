import { FileEditIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { type Ref, useImperativeHandle, useState } from 'react'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { orpc } from '@/utils/orpc'

type Entry = {
	id: string
	title: string
	content: string
	updatedAt: string | Date
}

/**
 * Ref methods for EntryPicker component
 */
export type EntryPickerRef = {
	open: () => void
	close: () => void
}

type EntryPickerProps = {
	ref?: Ref<EntryPickerRef>
	/** Called when an entry is selected */
	onSelect: (entry: Entry) => void
	/** Entry ID to exclude from the list (e.g., current entry) */
	excludeId?: string
	/** Dialog title */
	title?: string
}

/**
 * A dialog component for selecting an entry to reference.
 * Supports search filtering and keyboard navigation.
 */
export function EntryPicker({
	ref,
	onSelect,
	excludeId,
	title = '选择要引用的条目',
}: EntryPickerProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')

	// Fetch entries
	const { data: entriesData, isLoading } = useQuery({
		queryKey: ['entries', 'all', 'picker'],
		queryFn: () => orpc.entries.list.call({ filter: 'all', limit: 50 }),
		enabled: isOpen,
	})

	const entries = (entriesData?.items ?? []) as Entry[]

	// Filter entries by search query and exclude current entry
	const filteredEntries = entries.filter((entry) => {
		if (excludeId && entry.id === excludeId) return false
		if (!searchQuery.trim()) return true

		const query = searchQuery.toLowerCase()
		const titleMatch = entry.title?.toLowerCase().includes(query)
		const contentMatch = entry.content?.toLowerCase().includes(query)

		return titleMatch || contentMatch
	})

	// Expose methods via ref
	useImperativeHandle(ref, () => ({
		open: () => {
			setIsOpen(true)
			setSearchQuery('')
		},
		close: () => setIsOpen(false),
	}))

	const handleSelect = (entry: Entry) => {
		onSelect(entry)
		setIsOpen(false)
		setSearchQuery('')
	}

	const formatDate = (date: string | Date) => {
		const d = typeof date === 'string' ? new Date(date) : date
		return d.toLocaleDateString('zh-CN', {
			month: 'short',
			day: 'numeric',
		})
	}

	const getPreview = (content: string) => {
		// Strip HTML tags and get first 50 characters
		const text = content.replace(/<[^>]*>/g, '').trim()
		return text.length > 50 ? `${text.slice(0, 50)}...` : text
	}

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				{/* Search input */}
				<div className="relative">
					<HugeiconsIcon
						className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						icon={Search01Icon}
					/>
					<Input
						autoFocus
						className="pl-9"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索条目..."
						value={searchQuery}
					/>
				</div>

				{/* Entries list */}
				<div className="max-h-80 overflow-y-auto">
					{(() => {
						if (isLoading) {
							return (
								<div className="space-y-2 py-4">
									<Skeleton className="h-16 rounded-lg bg-muted" />
									<Skeleton className="h-16 rounded-lg bg-muted" />
									<Skeleton className="h-16 rounded-lg bg-muted" />
								</div>
							)
						}

						if (filteredEntries.length > 0) {
							return (
								<div className="space-y-1">
									{filteredEntries.map((entry) => (
										<button
											className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
											key={entry.id}
											onClick={() => handleSelect(entry)}
											type="button"
										>
											<HugeiconsIcon
												className="mt-0.5 size-4 shrink-0 text-muted-foreground"
												icon={FileEditIcon}
											/>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium">
													{entry.title || '无标题'}
												</p>
												{entry.content ? (
													<p className="truncate text-muted-foreground text-xs">
														{getPreview(entry.content)}
													</p>
												) : null}
											</div>
											<span className="shrink-0 text-muted-foreground text-xs">
												{formatDate(entry.updatedAt)}
											</span>
										</button>
									))}
								</div>
							)
						}

						return (
							<div className="py-8 text-center text-muted-foreground">
								{searchQuery ? <p>没有找到匹配的条目</p> : <p>暂无可引用的条目</p>}
							</div>
						)
					})()}
				</div>
			</DialogContent>
		</Dialog>
	)
}
