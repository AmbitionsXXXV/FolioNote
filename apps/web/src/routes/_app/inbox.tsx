import { InboxIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EntryList } from '@/components/entry-list'
import { QuickCapture } from '@/components/quick-capture'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/_app/inbox')({
	ssr: false,
	component: InboxPage,
})

/**
 * Renders the inbox page with header, quick-capture input, and an infinitely paginated entry list.
 *
 * @returns The page's React element containing the inbox header, QuickCapture input, and EntryList wired to infinite query state
 */
function InboxPage() {
	const { t } = useTranslation()
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
		queryKey: ['entries', 'inbox'],
		queryFn: ({ pageParam }) =>
			orpc.entries.list.call({
				filter: 'inbox',
				cursor: pageParam,
				limit: 20,
			}),
		getNextPageParam: (lastPage) => lastPage?.nextCursor,
		initialPageParam: undefined as string | undefined,
	})

	// Flatten all pages into a single array with safe access
	const entries =
		data?.pages?.flatMap((page) => page?.items ?? []).filter(Boolean) ?? []

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center gap-3">
				<div className="rounded-lg bg-primary/10 p-2">
					<HugeiconsIcon className="size-6 text-primary" icon={InboxIcon} />
				</div>
				<div>
					<h1 className="font-bold text-2xl">{t('entry.inbox')}</h1>
					<p className="text-muted-foreground text-sm">{t('entry.quickCapture')}</p>
				</div>
			</div>

			{/* Quick capture */}
			<div className="mb-8">
				<QuickCapture placeholder={t('entry.placeholder')} />
			</div>

			{/* Entry list */}
			<EntryList
				emptyMessage={t('entry.emptyInbox')}
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
