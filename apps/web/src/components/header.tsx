import {
	BookOpen01Icon,
	InboxIcon,
	Link01Icon,
	Rocket01Icon,
	Search01Icon,
	Tag01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useCommandPalette } from '@/contexts/command-palette-context'
import { SettingsMenu } from './settings-menu'
import { Button } from './ui/button'
import UserMenu from './user-menu'

/**
 * Renders the top application header with a logo link, navigation links (optional icons), and a user menu.
 *
 * @returns The header element containing the logo/home link, navigation links (Inbox and Library) with optional icons, and the user menu on the right.
 */
export default function Header() {
	const { t } = useTranslation()
	const { setOpen } = useCommandPalette()

	const links: Array<{
		to: string
		labelKey: string
		isLogo?: boolean
		icon?: IconSvgElement
	}> = [
		{ to: '/', labelKey: 'FolioNote', isLogo: true },
		{ to: '/inbox', labelKey: 'nav.inbox', icon: InboxIcon },
		{ to: '/library', labelKey: 'nav.library', icon: BookOpen01Icon },
		{ to: '/tags', labelKey: 'nav.tags', icon: Tag01Icon },
		{ to: '/sources', labelKey: 'nav.sources', icon: Link01Icon },
		{ to: '/review', labelKey: 'nav.review', icon: Rocket01Icon },
	]

	return (
		<div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="flex flex-row items-center justify-between px-4 py-2">
				<nav className="flex items-center gap-6">
					{links.map(({ to, labelKey, isLogo, icon }) =>
						isLogo ? (
							<Link
								className="font-bold font-script text-4xl text-primary"
								key={to}
								to={to}
							>
								{labelKey}
							</Link>
						) : (
							<Link
								className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground [&.active]:font-medium [&.active]:text-foreground"
								key={to}
								to={to}
							>
								{icon ? (
									<HugeiconsIcon className="size-4" icon={icon as IconSvgElement} />
								) : null}
								{t(labelKey)}
							</Link>
						)
					)}
				</nav>
				<div className="flex items-center gap-2">
					<Button
						className="gap-2 text-muted-foreground"
						onClick={() => setOpen(true)}
						size="sm"
						variant="outline"
					>
						<HugeiconsIcon className="size-4" icon={Search01Icon} />
						<span className="hidden sm:inline">{t('nav.search')}</span>
						<kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] opacity-100 sm:flex">
							<span className="text-xs">⌘</span>K
						</kbd>
					</Button>
					<SettingsMenu />
					<UserMenu />
				</div>
			</div>
		</div>
	)
}
