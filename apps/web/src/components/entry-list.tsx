import { AlertCircleIcon, Loading02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Entry } from '@/types'
import { orpc } from '@/utils/orpc'
import { EntryCard } from './entry-card'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

type EntryListProps = {
	entries: Entry[]
	isLoading?: boolean
	hasMore?: boolean
	onLoadMore?: () => void
	isLoadingMore?: boolean
	emptyMessage?: string
	errorMessage?: string
	onRetry?: () => void
}

/**
 * Renders a list of entries with support for pinned ordering, loading and empty states, and an optional "load more" control.
 *
 * @returns A React element containing the entries grid, including pinned and regular sections, skeletons for loading, an empty message when there are no entries, and an optional load-more button.
 */
export function EntryList({
	entries,
	isLoading = false,
	hasMore = false,
	onLoadMore,
	isLoadingMore = false,
	emptyMessage,
	errorMessage,
	onRetry,
}: EntryListProps) {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const resolvedEmptyMessage = emptyMessage ?? t('entry.empty')

	// Update entry mutation (for star/pin actions)
	const updateMutation = useMutation({
		mutationFn: (data: { id: string; isStarred?: boolean; isPinned?: boolean }) =>
			orpc.entries.update.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
		},
	})

	// Delete entry mutation
	const deleteMutation = useMutation({
		mutationFn: (data: { id: string }) => orpc.entries.delete.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
		},
	})

	const handleStar = (entry: Entry) => {
		updateMutation.mutate({
			id: entry.id,
			isStarred: !entry.isStarred,
		})
	}

	const handlePin = (entry: Entry) => {
		updateMutation.mutate({
			id: entry.id,
			isPinned: !entry.isPinned,
		})
	}

	const handleDelete = (entry: Entry) => {
		deleteMutation.mutate({ id: entry.id })
	}

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Skeleton className="h-36 rounded-lg" />
				<Skeleton className="h-36 rounded-lg" />
				<Skeleton className="h-36 rounded-lg" />
				<Skeleton className="h-36 rounded-lg" />
				<Skeleton className="h-36 rounded-lg" />
				<Skeleton className="h-36 rounded-lg" />
			</div>
		)
	}

	if (errorMessage) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<HugeiconsIcon
					className="mb-4 size-12 text-destructive/50"
					icon={AlertCircleIcon}
				/>
				<p className="mb-2 font-medium text-destructive">{t('common.loadFailed')}</p>
				<p className="mb-4 text-muted-foreground text-sm">{errorMessage}</p>
				{onRetry ? (
					<Button onClick={onRetry} variant="outline">
						{t('common.retry')}
					</Button>
				) : null}
			</div>
		)
	}

	if (entries.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<p className="text-muted-foreground">{resolvedEmptyMessage}</p>
			</div>
		)
	}

	// Separate pinned entries to show them first
	const pinnedEntries = entries.filter((e) => e.isPinned)
	const regularEntries = entries.filter((e) => !e.isPinned)

	return (
		<div className="space-y-6">
			{/* Pinned entries section */}
			{pinnedEntries.length > 0 ? (
				<div className="space-y-3">
					<h2 className="font-medium text-muted-foreground text-sm">
						{t('entry.pinnedSection')}
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{pinnedEntries.map((entry) => (
							<EntryCard
								contentText={entry.contentText}
								id={entry.id}
								isPinned={entry.isPinned}
								isStarred={entry.isStarred}
								key={entry.id}
								onDelete={() => handleDelete(entry)}
								onPin={() => handlePin(entry)}
								onStar={() => handleStar(entry)}
								title={entry.title}
								updatedAt={entry.updatedAt}
							/>
						))}
					</div>
				</div>
			) : null}

			{/* Regular entries */}
			{regularEntries.length > 0 ? (
				<div className="space-y-3">
					{pinnedEntries.length > 0 ? (
						<h2 className="font-medium text-muted-foreground text-sm">
							{t('common.other')}
						</h2>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{regularEntries.map((entry) => (
							<EntryCard
								contentText={entry.contentText}
								id={entry.id}
								isPinned={entry.isPinned}
								isStarred={entry.isStarred}
								key={entry.id}
								onDelete={() => handleDelete(entry)}
								onPin={() => handlePin(entry)}
								onStar={() => handleStar(entry)}
								title={entry.title}
								updatedAt={entry.updatedAt}
							/>
						))}
					</div>
				</div>
			) : null}

			{/* Load more button */}
			{hasMore && onLoadMore ? (
				<div className="flex justify-center pt-4">
					<button
						className="flex items-center gap-2 px-4 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground disabled:opacity-50"
						disabled={isLoadingMore}
						onClick={onLoadMore}
						type="button"
					>
						{isLoadingMore ? (
							<>
								<HugeiconsIcon
									className="size-4 animate-spin"
									icon={Loading02Icon}
								/>
								{t('common.loading')}
							</>
						) : (
							t('common.loadMore')
						)}
					</button>
				</div>
			) : null}
		</div>
	)
}
