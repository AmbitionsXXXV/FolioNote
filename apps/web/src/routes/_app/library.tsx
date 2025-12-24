import { Add01Icon, BookOpen01Icon, StarIcon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EntryList } from '@/components/entry-list'
import { Button } from '@/components/ui/button'
import { orpc } from '@/utils/orpc'

type FilterType = 'all' | 'starred' | 'pinned'

export const Route = createFileRoute('/_app/library')({
	// SPA 模式 - 库页面无需 SSR
	ssr: false,
	component: LibraryPage,
})

/**
 * Display the library view with a header, filter tabs, and a paginated list of user entries.
 *
 * Supports switching between filters (e.g., all, starred) and loading additional pages of entries; shows an appropriate empty-state message per active filter.
 *
 * @returns The React element for the library page UI.
 */
function LibraryPage() {
	const { t } = useTranslation()
	const [filter, setFilter] = useState<FilterType>('all')

	const {
		data,
		isLoading,
		isError,
		error,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
		refetch,
	} = useInfiniteQuery({
		queryKey: ['entries', 'library', filter],
		queryFn: ({ pageParam }) =>
			orpc.entries.list.call({
				filter: filter === 'all' ? 'all' : filter,
				cursor: pageParam,
				limit: 20,
			}),
		getNextPageParam: (lastPage) => lastPage?.nextCursor,
		initialPageParam: undefined as string | undefined,
	})

	// Flatten all pages and filter out inbox entries for 'all' filter with safe access
	const allEntries =
		data?.pages?.flatMap((page) => page?.items ?? []).filter(Boolean) ?? []
	const entries =
		filter === 'all' ? allEntries.filter((e) => !e.isInbox) : allEntries

	const filters: { key: FilterType; labelKey: string; icon?: IconSvgElement }[] = [
		{ key: 'all', labelKey: 'review.allItems' },
		{ key: 'starred', labelKey: 'entry.starred', icon: StarIcon },
	]

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<HugeiconsIcon className="size-6 text-primary" icon={BookOpen01Icon} />
					</div>
					<div>
						<h1 className="font-bold text-2xl">{t('entry.library')}</h1>
						<p className="text-muted-foreground text-sm">
							{t('entry.emptyLibrary')}
						</p>
					</div>
				</div>

				<Link to="/entries/new">
					<Button>
						<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
						{t('entry.newEntry')}
					</Button>
				</Link>
			</div>

			{/* Filter tabs */}
			<div className="mb-6 flex gap-2">
				{filters.map(({ key, labelKey, icon }) => (
					<Button
						key={key}
						onClick={() => setFilter(key)}
						size="sm"
						variant={filter === key ? 'default' : 'outline'}
					>
						{icon ? <HugeiconsIcon className="mr-1 size-4" icon={icon} /> : null}
						{t(labelKey)}
					</Button>
				))}
			</div>

			{/* Entry list */}
			<EntryList
				emptyMessage={t('entry.emptyLibrary')}
				entries={entries}
				errorMessage={
					isError ? (error?.message ?? t('common.unknownError')) : undefined
				}
				hasMore={hasNextPage}
				isLoading={isLoading}
				isLoadingMore={isFetchingNextPage}
				onLoadMore={() => fetchNextPage()}
				onRetry={refetch}
			/>
		</div>
	)
}
