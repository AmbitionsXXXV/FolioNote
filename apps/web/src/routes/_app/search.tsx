import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EntryList } from '@/components/entry-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/_app/search')({
	component: SearchPage,
	ssr: false,
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === 'string' ? search.q : '',
	}),
})

function SearchPage() {
	const { t } = useTranslation()
	const { q } = useSearch({ from: '/_app/search' })
	const [searchInput, setSearchInput] = useState(q)

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
		queryKey: ['search', 'entries', q],
		queryFn: ({ pageParam }) =>
			orpc.search.entries.call({
				query: q,
				cursor: pageParam,
				limit: 20,
			}),
		getNextPageParam: (lastPage) => lastPage?.nextCursor,
		initialPageParam: undefined as string | undefined,
		enabled: q.length > 0,
	})

	const entries =
		data?.pages?.flatMap((page) => page?.items ?? []).filter(Boolean) ?? []

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault()
		if (searchInput.trim()) {
			window.history.pushState(
				{},
				'',
				`/search?q=${encodeURIComponent(searchInput.trim())}`
			)
			window.location.reload()
		}
	}

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center gap-3">
				<div className="rounded-lg bg-primary/10 p-2">
					<HugeiconsIcon className="size-6 text-primary" icon={Search01Icon} />
				</div>
				<div>
					<h1 className="font-bold text-2xl">{t('nav.search')}</h1>
					<p className="text-muted-foreground text-sm">{t('search.placeholder')}</p>
				</div>
			</div>

			{/* Search form */}
			<form className="mb-8" onSubmit={handleSearch}>
				<div className="flex gap-2">
					<div className="relative flex-1">
						<HugeiconsIcon
							className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
							icon={Search01Icon}
						/>
						<Input
							className="pl-10"
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder={t('search.placeholder')}
							type="search"
							value={searchInput}
						/>
					</div>
					<Button type="submit">{t('nav.search')}</Button>
				</div>
			</form>

			{/* Search results */}
			{q ? (
				<>
					<p className="mb-4 text-muted-foreground text-sm">
						{(() => {
							if (isLoading) return t('common.loading')
							if (isError) return t('common.error')
							return t('search.resultCount', { count: entries.length })
						})()}
					</p>
					<EntryList
						emptyMessage={t('search.noResults')}
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
				</>
			) : (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<HugeiconsIcon
						className="mb-4 size-12 text-muted-foreground/50"
						icon={Search01Icon}
					/>
					<p className="mb-2 font-medium text-muted-foreground">{t('nav.search')}</p>
					<p className="text-muted-foreground text-sm">{t('search.placeholder')}</p>
				</div>
			)}
		</div>
	)
}
