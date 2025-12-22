import { LANGUAGE_LABELS } from '@folio/constants'
import { type SupportedLanguage, supportedLanguages } from '@folio/locales'
import {
	LanguageCircleIcon,
	Moon02Icon,
	Settings01Icon,
	Sun03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
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
} from './ui/dropdown-menu'

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

/**
 * Standalone settings menu for mobile header.
 * Desktop sidebar uses the settings integrated in UserMenu.
 */
export function SettingsMenu() {
	const { t } = useTranslation()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon" variant="ghost">
					<HugeiconsIcon className="size-5" icon={Settings01Icon} />
					<span className="sr-only">{t('common.settings')}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t('common.settings')}</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<LanguageSubmenu />
				<ThemeSubmenu />
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
