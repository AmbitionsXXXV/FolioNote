import { createFileRoute } from '@tanstack/react-router'
import SignUpForm from '@/components/sign-up-form'

export const Route = createFileRoute('/register')({
	// SPA 模式 - 注册页面无需 SSR
	ssr: false,
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
