import { useForm } from '@tanstack/react-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import z from 'zod'
import { authClient } from '@/lib/auth-client'
import Loader from './loader'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

/**
 * Render the sign-in form UI and handle user authentication.
 *
 * Displays a loader while session state is pending. Presents email and password fields,
 * validates inputs (email format and password length), and submits credentials to authenticate.
 * On successful sign-in navigates to the dashboard and shows a success toast; on failure shows an error toast.
 *
 * @returns The React element for the sign-in form.
 */
export default function SignInForm() {
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
			<h1 className="mb-6 text-center font-bold text-3xl">Welcome Back</h1>

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
								<Label htmlFor={field.name}>Email</Label>
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
								<Label htmlFor={field.name}>Password</Label>
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
							{state.isSubmitting ? 'Submitting...' : 'Sign In'}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Link className="text-indigo-600 hover:text-indigo-800" to="/register">
					Need an account? Sign Up
				</Link>
			</div>
		</div>
	)
}