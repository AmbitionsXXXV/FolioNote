import { createFileRoute } from '@tanstack/react-router'
import SignInForm from '@/components/sign-in-form'

export const Route = createFileRoute('/login')({
	// SPA 模式 - 登录页面无需 SSR
	ssr: false,
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
