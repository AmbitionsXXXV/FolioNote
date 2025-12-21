import { useForm } from '@tanstack/react-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import z from 'zod'
import { authClient } from '@/lib/auth-client'
import Loader from './loader'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

/**
 * Render a sign-up form UI and handle user registration flow.
 *
 * Renders a name, email, and password form with validation; while the authentication
 * session is pending, renders a Loader instead. Submitting the form attempts to
 * create an account via the auth client — on success navigates to `/dashboard` and
 * shows a success toast; on error shows an error toast with the server message.
 *
 * @returns A React element containing the sign-up form or a Loader when the session is pending.
 */
export default function SignUpForm() {
	const { t } = useTranslation()
	const navigate = useNavigate({
		from: '/',
	})
	const { isPending } = authClient.useSession()

	const form = useForm({
		defaultValues: {
			email: '',
			password: '',
			name: '',
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: value.name,
				},
				{
					onSuccess: () => {
						navigate({
							to: '/dashboard',
						})
						toast.success('Sign up successful')
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText)
					},
				}
			)
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, 'Name must be at least 2 characters'),
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
			<h1 className="mb-6 text-center font-bold text-3xl">
				{t('auth.createAccount')}
			</h1>

			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				<div>
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>{t('auth.name')}</Label>
								<Input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
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
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>{t('auth.email')}</Label>
								<Input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
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
							{state.isSubmitting ? t('common.loading') : t('auth.signUp')}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Link className="text-indigo-600 hover:text-indigo-800" to="/login">
					{t('auth.hasAccount')} {t('auth.signIn')}
				</Link>
			</div>
		</div>
	)
}
