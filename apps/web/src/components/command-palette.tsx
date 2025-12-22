import {
	BookOpen01Icon,
	InboxIcon,
	Link01Icon,
	Search01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from '@/components/ui/command'
import { useCommandPalette } from '@/contexts/command-palette-context'
import { orpc } from '@/utils/orpc'

export function CommandPalette() {
	const { t } = useTranslation()
	const { open, setOpen } = useCommandPalette()
	const [search, setSearch] = useState('')
	const navigate = useNavigate()

	// Global keyboard shortcut
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen(!open)
			}
		}

		document.addEventListener('keydown', down)
		return () => document.removeEventListener('keydown', down)
	}, [open, setOpen])

	// Clear search when dialog closes
	useEffect(() => {
		if (!open) {
			setSearch('')
		}
	}, [open])

	// Search entries when user types
	const { data: searchResults, isLoading } = useQuery({
		queryKey: ['command-search', search],
		queryFn: () =>
			orpc.search.entries.call({
				query: search,
				limit: 5,
			}),
		enabled: search.length > 0,
	})

	const handleSelect = useCallback(
		(callback: () => void) => {
			setOpen(false)
			callback()
		},
		[setOpen]
	)

	const entries = searchResults?.items ?? []

	return (
		<CommandDialog
			description={t('commandPalette.description')}
			onOpenChange={setOpen}
			open={open}
			title={t('commandPalette.title')}
		>
			<Command shouldFilter={false}>
				<CommandInput
					onValueChange={setSearch}
					placeholder={t('commandPalette.searchPlaceholder')}
					value={search}
				/>
				<CommandList>
					<CommandEmpty>
						{isLoading
							? t('commandPalette.searching')
							: t('commandPalette.noResults')}
					</CommandEmpty>

					{/* Search results */}
					{entries.length > 0 ? (
						<CommandGroup heading={t('commandPalette.entries')}>
							{entries.map((entry) => (
								<CommandItem
									key={entry.id}
									onSelect={() =>
										handleSelect(() =>
											navigate({ to: '/entries/$id', params: { id: entry.id } })
										)
									}
									value={`entry-${entry.id}`}
								>
									<HugeiconsIcon className="mr-2 size-4" icon={Search01Icon} />
									<span className="line-clamp-1">
										{entry.title || t('commandPalette.untitled')}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					) : null}

					{/* Quick navigation */}
					<CommandGroup heading={t('commandPalette.quickNavigation')}>
						<CommandItem
							onSelect={() => handleSelect(() => navigate({ to: '/inbox' }))}
							value="nav-inbox"
						>
							<HugeiconsIcon className="mr-2 size-4" icon={InboxIcon} />
							<span>{t('nav.inbox')}</span>
							<CommandShortcut>{t('nav.inbox')}</CommandShortcut>
						</CommandItem>
						<CommandItem
							onSelect={() => handleSelect(() => navigate({ to: '/library' }))}
							value="nav-library"
						>
							<HugeiconsIcon className="mr-2 size-4" icon={BookOpen01Icon} />
							<span>{t('nav.library')}</span>
							<CommandShortcut>{t('nav.library')}</CommandShortcut>
						</CommandItem>
						<CommandItem
							onSelect={() => handleSelect(() => navigate({ to: '/sources' }))}
							value="nav-sources"
						>
							<HugeiconsIcon className="mr-2 size-4" icon={Link01Icon} />
							<span>{t('nav.sources')}</span>
							<CommandShortcut>{t('nav.sources')}</CommandShortcut>
						</CommandItem>
						<CommandItem
							onSelect={() =>
								handleSelect(() => navigate({ to: '/search', search: { q: '' } }))
							}
							value="nav-search"
						>
							<HugeiconsIcon className="mr-2 size-4" icon={Search01Icon} />
							<span>{t('commandPalette.searchPage')}</span>
							<CommandShortcut>{t('common.search')}</CommandShortcut>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	)
}
