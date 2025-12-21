import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

/**
 * Render a user account menu that displays a loading placeholder, a sign-in link when unauthenticated, or a dropdown with account details and a sign-out action when authenticated.
 *
 * @returns A React element containing either a loading skeleton, a "Sign In" link button, or an account dropdown showing the user's name, email, and a "Sign Out" action that navigates to the root on success.
 */
export default function UserMenu() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { data: session, isPending } = authClient.useSession()

	if (isPending) {
		return <Skeleton className="h-9 w-24" />
	}

	if (!session) {
		return (
			<Link to="/login">
				<Button variant="outline">{t('auth.signIn')}</Button>
			</Link>
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<Button variant="outline">{session.user.name}</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-max max-w-40 bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t('common.settings')}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem className="break-all" title={session.user.email}>
						{session.user.email}
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuItem
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									navigate({
										to: '/',
									})
								},
							},
						})
					}}
					variant="destructive"
				>
					{t('auth.signOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
