import { type SupportedLanguage, supportedLanguages } from '@folio/locales'
import {
	LanguageCircleIcon,
	Logout03Icon,
	Moon02Icon,
	MoreVerticalIcon,
	Settings01Icon,
	Sun03Icon,
	UserCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LANGUAGE_LABELS } from '@/constants'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

type UserMenuProps = {
	collapsed?: boolean
}

function UserAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
	const sizeClass = size === 'md' ? 'size-10' : 'size-8'
	const iconSize = size === 'md' ? 'size-6' : 'size-5'

	return (
		<div
			className={cn(
				'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
				sizeClass
			)}
		>
			<HugeiconsIcon className={iconSize} icon={UserCircleIcon} />
		</div>
	)
}

function LanguageSubmenu() {
	const { t, i18n } = useTranslation()
	const currentLanguage = i18n.language as SupportedLanguage

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<HugeiconsIcon className="mr-2 size-4" icon={LanguageCircleIcon} />
				<span>{t('common.language')}</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuPortal>
				<DropdownMenuSubContent>
					{supportedLanguages.map((lang) => (
						<DropdownMenuItem key={lang} onClick={() => i18n.changeLanguage(lang)}>
							<span className={currentLanguage === lang ? 'font-medium' : ''}>
								{LANGUAGE_LABELS[lang] || lang}
							</span>
							{currentLanguage === lang && (
								<span className="ml-auto text-primary">✓</span>
							)}
						</DropdownMenuItem>
					))}
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	)
}

function ThemeSubmenu() {
	const { t } = useTranslation()
	const { theme, setTheme, resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	// 使用 resolvedTheme 来显示图标，避免 hydration 问题
	const currentTheme = mounted ? resolvedTheme : 'light'

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				{currentTheme === 'dark' ? (
					<HugeiconsIcon className="mr-2 size-4" icon={Moon02Icon} />
				) : (
					<HugeiconsIcon className="mr-2 size-4" icon={Sun03Icon} />
				)}
				<span>{t('common.theme')}</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuPortal>
				<DropdownMenuSubContent>
					<DropdownMenuItem onClick={() => setTheme('light')}>
						<HugeiconsIcon className="mr-2 size-4" icon={Sun03Icon} />
						<span className={theme === 'light' ? 'font-medium' : ''}>
							{t('common.themeLight')}
						</span>
						{theme === 'light' && <span className="ml-auto text-primary">✓</span>}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTheme('dark')}>
						<HugeiconsIcon className="mr-2 size-4" icon={Moon02Icon} />
						<span className={theme === 'dark' ? 'font-medium' : ''}>
							{t('common.themeDark')}
						</span>
						{theme === 'dark' && <span className="ml-auto text-primary">✓</span>}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTheme('system')}>
						<span className={theme === 'system' ? 'font-medium' : ''}>
							{t('common.themeSystem')}
						</span>
						{theme === 'system' && <span className="ml-auto text-primary">✓</span>}
					</DropdownMenuItem>
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	)
}

function SettingsSubmenu() {
	const { t } = useTranslation()

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<HugeiconsIcon className="mr-2 size-4" icon={Settings01Icon} />
				<span>{t('common.settings')}</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuPortal>
				<DropdownMenuSubContent>
					<DropdownMenuGroup>
						<DropdownMenuLabel>{t('common.settings')}</DropdownMenuLabel>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<LanguageSubmenu />
					<ThemeSubmenu />
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	)
}

function UserMenuTrigger({
	collapsed,
	userName,
	userEmail,
}: {
	collapsed: boolean
	userName: string
	userEmail: string
}) {
	return (
		<div
			className={cn(
				'inline-flex w-full cursor-pointer items-center justify-start gap-3 rounded-md p-2 font-medium text-sm outline-none transition-all hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
				collapsed && 'size-10 justify-center p-0'
			)}
		>
			<UserAvatar size="sm" />
			{!collapsed && (
				<>
					<div className="flex min-w-0 flex-1 flex-col items-start text-left">
						<span className="truncate font-medium text-sm">{userName}</span>
						<span className="truncate text-muted-foreground text-xs">
							{userEmail}
						</span>
					</div>
					<HugeiconsIcon
						className="size-4 shrink-0 text-muted-foreground"
						icon={MoreVerticalIcon}
					/>
				</>
			)}
		</div>
	)
}

function UserMenuHeader({
	userName,
	userEmail,
}: {
	userName: string
	userEmail: string
}) {
	return (
		<div className="flex items-center gap-3 px-2 py-2">
			<UserAvatar size="md" />
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium text-sm">{userName}</span>
				<span className="truncate text-muted-foreground text-xs">{userEmail}</span>
			</div>
		</div>
	)
}

/**
 * Render a user account menu that displays a loading placeholder, a sign-in link when unauthenticated, or a dropdown with account details and a sign-out action when authenticated.
 */
export default function UserMenu({ collapsed = false }: UserMenuProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { data: session, isPending } = authClient.useSession()

	if (isPending) {
		return (
			<div className={cn('p-2', collapsed && 'flex justify-center')}>
				<Skeleton className={cn('h-10', collapsed ? 'w-10' : 'h-12 w-full')} />
			</div>
		)
	}

	if (!session) {
		return (
			<div className={cn('p-2', collapsed && 'flex justify-center')}>
				<Link to="/login">
					<Button
						className={cn(collapsed && 'size-10 p-0')}
						size={collapsed ? 'icon' : 'default'}
						variant="outline"
					>
						{collapsed ? (
							<HugeiconsIcon className="size-5" icon={UserCircleIcon} />
						) : (
							t('auth.signIn')
						)}
					</Button>
				</Link>
			</div>
		)
	}

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					navigate({ to: '/' })
				},
			},
		})
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<UserMenuTrigger
					collapsed={collapsed}
					userEmail={session.user.email}
					userName={session.user.name}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={collapsed ? 'center' : 'end'}
				className="w-56"
				side="top"
				sideOffset={8}
			>
				<UserMenuHeader
					userEmail={session.user.email}
					userName={session.user.name}
				/>

				<DropdownMenuSeparator />

				<SettingsSubmenu />

				<DropdownMenuSeparator />

				<DropdownMenuItem onClick={handleSignOut} variant="destructive">
					<HugeiconsIcon className="mr-2 size-4" icon={Logout03Icon} />
					{t('auth.signOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
