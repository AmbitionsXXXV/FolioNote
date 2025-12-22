import {
	BookOpen01Icon,
	InboxIcon,
	LibraryIcon,
	MagicWand01Icon,
	PencilEdit02Icon,
	Search01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getUser } from '@/functions/get-user'
import { cn } from '@/lib/utils'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/')({
	component: HomeComponent,
	beforeLoad: async () => {
		const session = await getUser()
		return { session }
	},
})

function HomeComponent() {
	const { t } = useTranslation()
	const { session } = Route.useRouteContext()
	const healthCheck = useQuery(orpc.healthCheck.queryOptions())

	const quickActions: Array<{
		icon: IconSvgElement
		label: string
		description: string
		href: string
		color: string
	}> = [
		{
			icon: PencilEdit02Icon,
			label: t('entry.newEntry'),
			description: t('home.actionDescription.newEntry'),
			href: '/entries/new',
			color:
				'from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20',
		},
		{
			icon: InboxIcon,
			label: t('entry.inbox'),
			description: t('home.actionDescription.inbox'),
			href: '/inbox',
			color:
				'from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20',
		},
		{
			icon: LibraryIcon,
			label: t('entry.library'),
			description: t('home.actionDescription.library'),
			href: '/library',
			color:
				'from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20',
		},
		{
			icon: Search01Icon,
			label: t('common.search'),
			description: t('home.actionDescription.search'),
			href: '/search',
			color:
				'from-fuchsia-500/10 to-violet-500/10 hover:from-fuchsia-500/20 hover:to-violet-500/20',
		},
	]

	return (
		<div className="relative h-full overflow-auto">
			<div className="container mx-auto max-w-5xl px-6 py-12">
				{/* Hero Section */}
				<div className="mb-16 animate-fade-in">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
						<div
							className={cn(
								'size-1.5 rounded-full',
								healthCheck.data ? 'bg-green-500' : 'bg-red-500',
								healthCheck.data ? 'animate-pulse' : ''
							)}
						/>
						<span className="font-medium font-script text-muted-foreground text-xs">
							{(() => {
								if (healthCheck.isLoading) return t('home.connecting')
								return healthCheck.data ? t('home.systemReady') : t('home.offline')
							})()}
						</span>
					</div>

					<h1 className="mb-4 font-display font-semibold text-5xl leading-tight tracking-tight md:text-6xl">
						{session ? (
							<>
								{t('auth.welcome')},
								<br />
								<span className="bg-linear-to-br from-primary via-purple-400 to-violet-300 bg-clip-text font-script font-script-en text-transparent">
									{session.user.name?.split(' ')[0] || 'there'}
								</span>
							</>
						) : (
							<>
								{t('home.welcomePersonal')}
								<br />
								<span className="bg-linear-to-br from-primary via-purple-400 to-violet-300 bg-clip-text text-transparent">
									{t('home.learningSystem')}
								</span>
							</>
						)}
					</h1>

					<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
						{session ? t('home.subtitleUser') : t('home.subtitleGuest')}
					</p>
				</div>

				{/* Quick Actions Grid */}
				{session && (
					<div className="mb-16 animate-fade-in delay-100">
						<div className="mb-6 flex items-center gap-3">
							<HugeiconsIcon
								className="h-5 w-5 text-primary"
								icon={MagicWand01Icon}
							/>
							<h2 className="font-script font-semibold text-2xl">
								{t('home.quickActions')}
							</h2>
						</div>

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{quickActions.map((action, index) => (
								<Link
									className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
									key={action.href}
									style={{ animationDelay: `${(index + 2) * 100}ms` }}
									to={action.href}
								>
									<div
										className={cn(
											'absolute inset-0 bg-linear-to-br',
											action.color,
											'opacity-0 transition-opacity group-hover:opacity-100'
										)}
									/>
									<div className="relative">
										<div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
											<HugeiconsIcon
												className="size-6 text-primary"
												icon={action.icon}
											/>
										</div>
										<h3 className="mb-1 font-semibold">{action.label}</h3>
										<p className="text-muted-foreground text-sm">
											{action.description}
										</p>
									</div>
								</Link>
							))}
						</div>
					</div>
				)}

				{/* Feature Highlights */}
				<div className="animate-fade-in delay-200">
					<div className="mb-6 flex items-center gap-3">
						<HugeiconsIcon className="size-5 text-primary" icon={BookOpen01Icon} />
						<h2 className="font-script font-semibold text-2xl">
							{t('home.whatYouCanDo')}
						</h2>
					</div>

					<div className="grid gap-6 md:grid-cols-3">
						<div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30">
							<img
								alt={t('home.feature.capture.title')}
								className="mb-3 size-12"
								src="/img/note.png"
							/>
							<h3 className="mb-2 font-display font-semibold text-lg">
								{t('home.feature.capture.title')}
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								{t('home.feature.capture.desc')}
							</p>
						</div>

						<div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30">
							<img
								alt={t('home.feature.organize.title')}
								className="mb-3 size-12"
								src="/img/bookmark.png"
							/>
							<h3 className="mb-2 font-display font-semibold text-lg">
								{t('home.feature.organize.title')}
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								{t('home.feature.organize.desc')}
							</p>
						</div>

						<div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30">
							<img
								alt={t('home.feature.revisit.title')}
								className="mb-3 size-12"
								src="/img/zoom.png"
							/>
							<h3 className="mb-2 font-display font-semibold text-lg">
								{t('home.feature.revisit.title')}
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								{t('home.feature.revisit.desc')}
							</p>
						</div>
					</div>
				</div>

				{/* CTA Section */}
				{!session && (
					<div className="mt-16 animate-fade-in text-center delay-300">
						<div className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-purple-500/5 to-transparent p-8">
							<h3 className="mb-3 font-display font-semibold text-2xl">
								{t('home.cta.title')}
							</h3>
							<p className="mb-6 text-muted-foreground">{t('home.cta.desc')}</p>
							<div className="flex flex-wrap justify-center gap-3">
								<Link
									className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105"
									to="/register"
								>
									{t('home.cta.getStarted')}
								</Link>
								<Link
									className="rounded-xl border border-border px-6 py-3 font-semibold transition-colors hover:bg-accent"
									to="/login"
								>
									{t('auth.signIn')}
								</Link>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
