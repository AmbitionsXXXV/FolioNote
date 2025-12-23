import { GoogleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useForm } from '@tanstack/react-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import z from 'zod'
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth-client'
import Loader from './loader'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

/**
 * Renders the sign-in form and handles user authentication.
 *
 * Displays a loader while session state is pending, validates email and password, submits credentials,
 * navigates to the dashboard and shows a success toast on success, and shows an error toast on failure.
 *
 * @returns The React element for the sign-in form.
 */
export default function SignInForm() {
	const { t } = useTranslation()
	const navigate = useNavigate({
		from: '/',
	})
	const { isPending } = authClient.useSession()

	const form = useForm({
		defaultValues: {
			email: '',
			password: '',
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: '/dashboard',
						})
						toast.success('Sign in successful')
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText)
					},
				}
			)
		},
		validators: {
			onSubmit: z.object({
				email: z.email('Invalid email address'),
				password: z.string().min(8, 'Password must be at least 8 characters'),
			}),
		},
	})

	if (isPending) {
		return <Loader />
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">{t('auth.welcome')}</h1>

			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				<div>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>{t('auth.email')}</Label>
								<Input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="you@example.com"
									type="email"
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>{t('auth.password')}</Label>
								<Input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="password"
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe>
					{(state) => (
						<Button
							className="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{state.isSubmitting ? t('common.loading') : t('auth.signIn')}
						</Button>
					)}
				</form.Subscribe>

				<Separator />

				<Button
					className="w-full"
					onClick={() =>
						authClient.signIn.social({
							provider: 'google',
							callbackURL: `${import.meta.env.VITE_WEB_URL}/dashboard`,
						})
					}
				>
					<HugeiconsIcon className="size-6 fill-white" icon={GoogleIcon} />
				</Button>
			</form>

			<div className="mt-4 text-center">
				<Link className="text-indigo-600 hover:text-indigo-800" to="/register">
					{t('auth.noAccount')} {t('auth.signUp')}
				</Link>
			</div>
		</div>
	)
}
