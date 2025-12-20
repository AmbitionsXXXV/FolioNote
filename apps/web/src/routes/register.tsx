import { createFileRoute } from '@tanstack/react-router'
import SignUpForm from '@/components/sign-up-form'

export const Route = createFileRoute('/register')({
	component: RouteComponent,
})

/**
 * Renders the sign-up form used by the /register route.
 *
 * @returns The JSX element that renders the SignUpForm component.
 */
function RouteComponent() {
	return <SignUpForm />
}