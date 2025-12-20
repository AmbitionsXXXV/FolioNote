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
			label: 'New Entry',
			description: 'Capture a new learning moment',
			href: '/entries/new',
			color:
				'from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20',
		},
		{
			icon: InboxIcon,
			label: 'Inbox',
			description: 'Process your captures',
			href: '/inbox',
			color:
				'from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20',
		},
		{
			icon: LibraryIcon,
			label: 'Library',
			description: 'Browse your collection',
			href: '/library',
			color:
				'from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20',
		},
		{
			icon: Search01Icon,
			label: 'Search',
			description: 'Find what you learned',
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
							className={`h-1.5 w-1.5 rounded-full ${healthCheck.data ? 'bg-green-500' : 'bg-red-500'} ${healthCheck.data ? 'animate-pulse' : ''}`}
						/>
						<span className="font-medium text-muted-foreground text-xs">
							{(() => {
								if (healthCheck.isLoading) return 'Connecting...'
								return healthCheck.data ? 'System Ready' : 'Offline'
							})()}
						</span>
					</div>

					<h1 className="mb-4 font-display font-semibold text-5xl leading-tight tracking-tight md:text-6xl">
						{session ? (
							<>
								Welcome back,
								<br />
								<span className="bg-linear-to-br from-primary via-purple-400 to-violet-300 bg-clip-text text-transparent">
									{session.user.name?.split(' ')[0] || 'there'}
								</span>
							</>
						) : (
							<>
								Your personal
								<br />
								<span className="bg-linear-to-br from-primary via-purple-400 to-violet-300 bg-clip-text text-transparent">
									learning system
								</span>
							</>
						)}
					</h1>

					<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
						{session
							? 'Continue building your knowledge repository. Capture insights, organize thoughts, and revisit what matters.'
							: 'Capture, organize, and revisit everything you learn. A cross-platform system for lifelong learning.'}
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
							<h2 className="font-display font-semibold text-2xl">Quick Actions</h2>
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
										<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
											<HugeiconsIcon
												className="h-6 w-6 text-primary"
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
						<HugeiconsIcon className="h-5 w-5 text-primary" icon={BookOpen01Icon} />
						<h2 className="font-display font-semibold text-2xl">What You Can Do</h2>
					</div>

					<div className="grid gap-6 md:grid-cols-3">
						<div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30">
							<div className="mb-3 text-3xl">📝</div>
							<h3 className="mb-2 font-display font-semibold text-lg">
								Capture Insights
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Quickly jot down what you're learning. Rich text, code snippets, and
								more.
							</p>
						</div>

						<div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30">
							<div className="mb-3 text-3xl">🏷️</div>
							<h3 className="mb-2 font-display font-semibold text-lg">
								Organize Freely
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Tag, categorize, and link your notes. Build your personal knowledge
								graph.
							</p>
						</div>

						<div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30">
							<div className="mb-3 text-3xl">🔍</div>
							<h3 className="mb-2 font-display font-semibold text-lg">
								Revisit Anytime
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Powerful search and review tools help you rediscover what you've
								learned.
							</p>
						</div>
					</div>
				</div>

				{/* CTA Section */}
				{!session && (
					<div className="mt-16 animate-fade-in text-center delay-300">
						<div className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-purple-500/5 to-transparent p-8">
							<h3 className="mb-3 font-display font-semibold text-2xl">
								Ready to start learning?
							</h3>
							<p className="mb-6 text-muted-foreground">
								Join FolioNote and build your personal knowledge system today.
							</p>
							<div className="flex flex-wrap justify-center gap-3">
								<Link
									className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105"
									to="/register"
								>
									Get Started
								</Link>
								<Link
									className="rounded-xl border border-border px-6 py-3 font-semibold transition-colors hover:bg-accent"
									to="/login"
								>
									Sign In
								</Link>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
