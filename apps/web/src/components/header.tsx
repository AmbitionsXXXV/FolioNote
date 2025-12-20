import { BookOpen01Icon, InboxIcon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import UserMenu from './user-menu'

/**
 * Renders the top application header with a logo link, navigation links (optional icons), and a user menu.
 *
 * @returns The header element containing the logo/home link, navigation links (Inbox and Library) with optional icons, and the user menu on the right.
 */
export default function Header() {
	const links: Array<{
		to: string
		label: string
		isLogo?: boolean
		icon?: IconSvgElement
	}> = [
		{ to: '/', label: 'FolioNote', isLogo: true },
		{ to: '/inbox', label: '收件箱', icon: InboxIcon },
		{ to: '/library', label: '资料库', icon: BookOpen01Icon },
	]

	return (
		<div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="flex flex-row items-center justify-between px-4 py-2">
				<nav className="flex items-center gap-6">
					{links.map(({ to, label, isLogo, icon }) =>
						isLogo ? (
							<Link className="font-bold text-lg text-primary" key={to} to={to}>
								{label}
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
								{label}
							</Link>
						)
					)}
				</nav>
				<div className="flex items-center gap-2">
					<UserMenu />
				</div>
			</div>
		</div>
	)
}