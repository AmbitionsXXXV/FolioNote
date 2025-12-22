import {
	Add01Icon,
	Book02Icon,
	Link01Icon,
	MusicNote01Icon,
	News01Icon,
	Pdf01Icon,
	Video01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SourceCard } from '@/components/source-card'
import { SourceDialog } from '@/components/source-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { orpc } from '@/utils/orpc'

type SourceType = 'link' | 'pdf' | 'book' | 'article' | 'video' | 'podcast' | 'other'

type FilterType = SourceType | 'all'

const SOURCE_TYPE_CONFIG: Record<
	SourceType,
	{ label: string; icon: IconSvgElement }
> = {
	link: { label: '链接', icon: Link01Icon },
	pdf: { label: 'PDF', icon: Pdf01Icon },
	book: { label: '书籍', icon: Book02Icon },
	article: { label: '文章', icon: News01Icon },
	video: { label: '视频', icon: Video01Icon },
	podcast: { label: '播客', icon: MusicNote01Icon },
	other: { label: '其他', icon: Link01Icon },
}

export const Route = createFileRoute('/_app/sources')({
	component: SourcesPage,
})

function SourcesPage() {
	const { t } = useTranslation()
	const [filter, setFilter] = useState<FilterType>('all')
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingSource, setEditingSource] = useState<{
		id: string
		type: SourceType
		title: string
		url?: string | null
		author?: string | null
		publishedAt?: Date | null
		metadata?: string | null
	} | null>(null)

	const queryClient = useQueryClient()

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
		// 使用独立的 infinite queryKey，避免与 useQuery(['sources', 'all']) 等非 infinite 查询产生缓存结构冲突
		queryKey: ['sources', 'infinite', filter],
		queryFn: ({ pageParam }) =>
			orpc.sources.list.call({
				type: filter === 'all' ? undefined : filter,
				cursor: pageParam,
				limit: 20,
			}),
		getNextPageParam: (lastPage) =>
			lastPage?.hasMore ? lastPage.nextCursor : undefined,
		initialPageParam: undefined as string | undefined,
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.sources.delete.call({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sources'] })
			toast.success('来源已删除')
		},
		onError: () => {
			toast.error('删除失败')
		},
	})

	const sources =
		data?.pages?.flatMap((page) => page?.items ?? []).filter(Boolean) ?? []

	const filters: { key: FilterType; labelKey: string; icon?: IconSvgElement }[] = [
		{ key: 'all', labelKey: 'review.allItems' },
		{ key: 'link', labelKey: 'source.link', icon: Link01Icon },
		{ key: 'book', labelKey: 'source.book', icon: Book02Icon },
		{ key: 'article', labelKey: 'source.article', icon: News01Icon },
		{ key: 'video', labelKey: 'source.video', icon: Video01Icon },
		{ key: 'podcast', labelKey: 'source.podcast', icon: MusicNote01Icon },
	]

	const handleEdit = (source: (typeof sources)[0]) => {
		setEditingSource({
			id: source.id,
			type: source.type as SourceType,
			title: source.title,
			url: source.url,
			author: source.author,
			publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
			metadata: source.metadata,
		})
		setIsDialogOpen(true)
	}

	const handleCreate = () => {
		setEditingSource(null)
		setIsDialogOpen(true)
	}

	const handleDialogClose = () => {
		setIsDialogOpen(false)
		setEditingSource(null)
	}

	const renderSourceList = () => {
		if (isLoading) {
			return (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
				</div>
			)
		}

		if (isError) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<HugeiconsIcon
						className="mb-4 size-12 text-destructive/50"
						icon={Link01Icon}
					/>
					<p className="mb-2 font-medium text-destructive">{t('common.error')}</p>
					<p className="mb-4 text-muted-foreground text-sm">
						{error?.message ?? t('common.unknownError')}
					</p>
					<Button onClick={() => refetch()} variant="outline">
						{t('common.retry')}
					</Button>
				</div>
			)
		}

		if (sources.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<HugeiconsIcon
						className="mb-4 size-12 text-muted-foreground/50"
						icon={Link01Icon}
					/>
					<p className="mb-2 font-medium text-muted-foreground">
						{t('source.noSources')}
					</p>
					<p className="mb-4 text-muted-foreground text-sm">
						{t('source.addSource')}
					</p>
					<Button onClick={handleCreate} variant="outline">
						<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
						{t('source.newSource')}
					</Button>
				</div>
			)
		}

		return (
			<>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{sources.map((source) => (
						<SourceCard
							key={source.id}
							{...source}
							icon={
								SOURCE_TYPE_CONFIG[source.type as SourceType]?.icon || Link01Icon
							}
							onDelete={() => deleteMutation.mutate(source.id)}
							onEdit={() => handleEdit(source)}
							typeLabel={
								SOURCE_TYPE_CONFIG[source.type as SourceType]?.label || '其他'
							}
						/>
					))}
				</div>

				{/* Load more */}
				{hasNextPage ? (
					<div className="mt-8 flex justify-center">
						<Button
							disabled={isFetchingNextPage}
							onClick={() => fetchNextPage()}
							variant="outline"
						>
							{isFetchingNextPage ? t('common.loading') : t('common.more')}
						</Button>
					</div>
				) : null}
			</>
		)
	}

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<HugeiconsIcon className="size-6 text-primary" icon={Link01Icon} />
					</div>
					<div>
						<h1 className="font-bold text-2xl">{t('source.sources')}</h1>
						<p className="text-muted-foreground text-sm">{t('source.noSources')}</p>
					</div>
				</div>

				<Button onClick={handleCreate}>
					<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
					{t('source.addSource')}
				</Button>
			</div>

			{/* Filter tabs */}
			<div className="mb-6 flex flex-wrap gap-2">
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

			{/* Source list */}
			{renderSourceList()}

			{/* Source dialog */}
			<SourceDialog
				onClose={handleDialogClose}
				open={isDialogOpen}
				source={editingSource}
			/>
		</div>
	)
}
