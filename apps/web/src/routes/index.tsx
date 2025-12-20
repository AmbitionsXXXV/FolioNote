import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/')({
	component: HomeComponent,
})

/**
 * Displays the home page section that reports the API health status.
 *
 * @returns A JSX element containing an "API Status" panel with a colored dot (green when health is present, red when absent) and status text: "Checking..." while loading, "Connected" when healthy, and "Disconnected" otherwise.
 */
function HomeComponent() {
	const healthCheck = useQuery(orpc.healthCheck.queryOptions())

	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<div className="grid gap-6">
				<section className="rounded-lg border p-4">
					<h2 className="mb-2 font-medium">API Status</h2>
					<div className="flex items-center gap-2">
						<div
							className={`h-2 w-2 rounded-full ${healthCheck.data ? 'bg-green-500' : 'bg-red-500'}`}
						/>
						<span className="text-muted-foreground text-sm">
							{(() => {
								if (healthCheck.isLoading) {
									return 'Checking...'
								}
								if (healthCheck.data) {
									return 'Connected'
								}
								return 'Disconnected'
							})()}
						</span>
					</div>
				</section>
			</div>
		</div>
	)
}