import { Add01Icon, BookOpen01Icon, StarIcon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { EntryList } from '@/components/entry-list'
import { Button } from '@/components/ui/button'
import { getUser } from '@/functions/get-user'
import { orpc } from '@/utils/orpc'

type FilterType = 'all' | 'starred' | 'pinned'

export const Route = createFileRoute('/library')({
	component: LibraryPage,
	beforeLoad: async () => {
		const session = await getUser()
		return { session }
	},
	loader: ({ context }) => {
		if (!context.session) {
			throw redirect({
				to: '/login',
			})
		}
	},
})

/**
 * Render the library page that displays user entries with filter tabs, a header, and paginated entry list.
 *
 * Renders filter controls for selecting which entries to show, a button to create a new entry, and an EntryList that supports loading more pages and shows an appropriate empty-state message per filter.
 *
 * @returns The React element for the library page UI.
 */
function LibraryPage() {
	const [filter, setFilter] = useState<FilterType>('all')

	const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
		useInfiniteQuery({
			queryKey: ['entries', 'library', filter],
			queryFn: ({ pageParam }) =>
				orpc.entries.list.call({
					filter: filter === 'all' ? 'all' : filter,
					cursor: pageParam,
					limit: 20,
				}),
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: undefined as string | undefined,
		})

	// Flatten all pages and filter out inbox entries for 'all' filter
	const allEntries = data?.pages.flatMap((page) => page.items) ?? []
	const entries =
		filter === 'all' ? allEntries.filter((e) => !e.isInbox) : allEntries

	const filters: { key: FilterType; label: string; icon?: IconSvgElement }[] = [
		{ key: 'all', label: '全部' },
		{ key: 'starred', label: '收藏', icon: StarIcon },
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
						<h1 className="font-bold text-2xl">资料库</h1>
						<p className="text-muted-foreground text-sm">整理好的学习笔记</p>
					</div>
				</div>

				<Link to="/entries/new">
					<Button>
						<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
						新建笔记
					</Button>
				</Link>
			</div>

			{/* Filter tabs */}
			<div className="mb-6 flex gap-2">
				{filters.map(({ key, label, icon }) => (
					<Button
						key={key}
						onClick={() => setFilter(key)}
						size="sm"
						variant={filter === key ? 'default' : 'outline'}
					>
						{icon ? <HugeiconsIcon className="mr-1 size-4" icon={icon} /> : null}
						{label}
					</Button>
				))}
			</div>

			{/* Entry list */}
			<EntryList
				emptyMessage={
					filter === 'starred'
						? '暂无收藏的笔记'
						: '资料库是空的，从收件箱整理笔记或创建新笔记'
				}
				entries={entries}
				hasMore={hasNextPage}
				isLoading={isLoading}
				isLoadingMore={isFetchingNextPage}
				onLoadMore={() => fetchNextPage()}
			/>
		</div>
	)
}