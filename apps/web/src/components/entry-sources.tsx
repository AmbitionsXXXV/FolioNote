import {
	Book02Icon,
	Cancel01Icon,
	Link01Icon,
	MusicNote01Icon,
	News01Icon,
	Pdf01Icon,
	PlusSignIcon,
	Video01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Ref, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { orpc } from '@/utils/orpc'

type Source = {
	id: string
	title: string
	type: string
	url: string | null
	author: string | null
}

const SOURCE_TYPE_ICONS: Record<string, IconSvgElement> = {
	link: Link01Icon,
	pdf: Pdf01Icon,
	book: Book02Icon,
	article: News01Icon,
	video: Video01Icon,
	podcast: MusicNote01Icon,
	other: Link01Icon,
}

/**
 * Ref methods for EntrySources component
 */
export type EntrySourcesRef = {
	openSourcePicker: () => void
	getSources: () => Source[]
	addSource: (sourceId: string) => void
}

type EntrySourcesProps = {
	entryId: string
	ref?: Ref<EntrySourcesRef>
}

/**
 * Component for managing sources on an entry.
 * Displays current sources and allows adding/removing sources.
 */
export function EntrySources({ entryId, ref }: EntrySourcesProps) {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const [isOpen, setIsOpen] = useState(false)

	// Fetch entry's current sources
	const { data: entrySources = [] } = useQuery({
		queryKey: ['entries', entryId, 'sources'],
		queryFn: () => orpc.sources.getEntrySources.call({ entryId }),
	})

	// Fetch all user sources
	const { data: allSourcesData } = useQuery({
		queryKey: ['sources', 'all'],
		queryFn: () => orpc.sources.list.call({ limit: 100 }),
	})

	const allSources = allSourcesData?.items ?? []

	// Add source mutation
	const addSourceMutation = useMutation({
		mutationFn: (sourceId: string) =>
			orpc.sources.addToEntry.call({ entryId, sourceId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries', entryId, 'sources'] })
			toast.success(t('entrySources.sourceLinked'))
		},
		onError: () => {
			toast.error(t('entrySources.linkSourceFailed'))
		},
	})

	// Remove source mutation
	const removeSourceMutation = useMutation({
		mutationFn: (sourceId: string) =>
			orpc.sources.removeFromEntry.call({ entryId, sourceId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries', entryId, 'sources'] })
			toast.success(t('entrySources.sourceRemoved'))
		},
		onError: () => {
			toast.error(t('entrySources.removeSourceFailed'))
		},
	})

	const handleAddSource = (sourceId: string) => {
		addSourceMutation.mutate(sourceId)
	}

	const handleRemoveSource = (sourceId: string) => {
		removeSourceMutation.mutate(sourceId)
	}

	// Expose methods via ref
	useImperativeHandle(ref, () => ({
		openSourcePicker: () => setIsOpen(true),
		getSources: () => allSources as Source[],
		addSource: (sourceId: string) => handleAddSource(sourceId),
	}))

	// Filter out sources that are already on the entry
	const entrySourceIds = new Set(entrySources.map((s: Source) => s.id))
	const availableSources = allSources.filter(
		(s: Source) => !entrySourceIds.has(s.id)
	)

	const getSourceIcon = (type: string) => SOURCE_TYPE_ICONS[type] || Link01Icon

	return (
		<div className="flex flex-wrap items-center gap-2">
			{/* Display current sources */}
			{entrySources.map((source: Source) => (
				<Badge
					className="flex items-center gap-1 pr-1"
					key={source.id}
					variant="outline"
				>
					<HugeiconsIcon className="size-3" icon={getSourceIcon(source.type)} />
					<span className="max-w-32 truncate">{source.title}</span>
					<button
						className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
						disabled={removeSourceMutation.isPending}
						onClick={() => handleRemoveSource(source.id)}
						title={t('entrySources.removeSource')}
						type="button"
					>
						<HugeiconsIcon className="size-3" icon={Cancel01Icon} />
					</button>
				</Badge>
			))}

			{/* Add source button */}
			<Popover onOpenChange={setIsOpen} open={isOpen}>
				<PopoverTrigger
					render={
						<Button className="h-6 gap-1 px-2 text-xs" size="sm" variant="ghost" />
					}
				>
					<HugeiconsIcon className="size-3" icon={Link01Icon} />
					{t('entrySources.linkSource')}
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-2">
					{/* Available sources list */}
					{availableSources.length > 0 ? (
						<div className="max-h-64 space-y-1 overflow-y-auto">
							<p className="mb-1 text-muted-foreground text-xs">
								{t('entrySources.selectSource')}
							</p>
							{availableSources.map((source: Source) => (
								<button
									className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
									disabled={addSourceMutation.isPending}
									key={source.id}
									onClick={() => {
										handleAddSource(source.id)
										setIsOpen(false)
									}}
									type="button"
								>
									<HugeiconsIcon
										className="size-4 shrink-0 text-muted-foreground"
										icon={getSourceIcon(source.type)}
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium">{source.title}</p>
										{source.author ? (
											<p className="truncate text-muted-foreground text-xs">
												{source.author}
											</p>
										) : null}
									</div>
								</button>
							))}
						</div>
					) : null}

					{/* Empty state messages */}
					{availableSources.length === 0 && entrySources.length > 0 && (
						<p className="py-2 text-center text-muted-foreground text-xs">
							{t('entrySources.allSourcesLinked')}
						</p>
					)}
					{availableSources.length === 0 &&
						entrySources.length === 0 &&
						allSources.length === 0 && (
							<p className="py-2 text-center text-muted-foreground text-xs">
								{t('entrySources.noSourcesAvailable')}
							</p>
						)}

					{/* Link to sources page */}
					<div className="mt-2 border-t pt-2">
						<a
							className="flex items-center justify-center gap-1 text-muted-foreground text-xs hover:text-foreground"
							href="/sources"
						>
							<HugeiconsIcon className="size-3" icon={PlusSignIcon} />
							{t('entrySources.manageSources')}
						</a>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}
