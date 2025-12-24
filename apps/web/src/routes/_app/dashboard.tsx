import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/_app/dashboard')({
	// SPA 模式 - 仅客户端渲染
	ssr: false,
	component: RouteComponent,
})

function RouteComponent() {
	const { t } = useTranslation()
	const { session } = Route.useRouteContext()
	const privateData = useQuery(orpc.privateData.queryOptions())

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			<h1 className="mb-4 font-bold text-2xl">{t('nav.dashboard')}</h1>
			<p className="mb-2">{t('dashboard.welcome', { name: session.user.name })}</p>
			<p className="text-muted-foreground">
				{t('dashboard.apiLabel')} {privateData.data?.message}
			</p>
		</div>
	)
}
