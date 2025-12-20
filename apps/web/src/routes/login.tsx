import { createFileRoute } from '@tanstack/react-router'
import SignInForm from '@/components/sign-in-form'

export const Route = createFileRoute('/login')({
	component: RouteComponent,
})

/**
 * React route component for the "/login" route that renders the sign-in form.
 *
 * @returns The JSX element that renders the `SignInForm` component.
 */
function RouteComponent() {
	return <SignInForm />
}