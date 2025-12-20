import {
	ArrowRight01Icon,
	CheckmarkCircle02Icon,
	InboxIcon,
	RefreshIcon,
	Rocket01Icon,
	StarIcon,
	ViewIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser } from '@/functions/get-user'
import { cn } from '@/lib/utils'
import { orpc } from '@/utils/orpc'

type ReviewRule = 'new' | 'starred' | 'unreviewed' | 'all'

type Entry = {
	id: string
	title: string
	content: string
	isStarred: boolean
	isPinned: boolean
	isInbox: boolean
	createdAt: Date | string
	updatedAt: Date | string
}

const REVIEW_RULES: {
	key: ReviewRule
	label: string
	icon: IconSvgElement
	description: string
}[] = [
	{
		key: 'new',
		label: '新条目',
		icon: InboxIcon,
		description: '最近 7 天创建且从未复习过的条目',
	},
	{
		key: 'starred',
		label: '收藏条目',
		icon: StarIcon,
		description: '标记为收藏的重要条目',
	},
	{
		key: 'unreviewed',
		label: '未复习',
		icon: ViewIcon,
		description: '从未复习过的所有条目',
	},
	{
		key: 'all',
		label: '全部',
		icon: RefreshIcon,
		description: '所有条目（随机）',
	},
]

export const Route = createFileRoute('/review')({
	component: ReviewPage,
	beforeLoad: async () => {
		const session = await getUser()
		return { session }
	},
	loader: ({ context }) => {
		if (!context.session) {
			throw redirect({
				to: '/login',
			})
		}
	},
})

function ReviewPage() {
	const [selectedRule, setSelectedRule] = useState<ReviewRule>('all')
	const [currentIndex, setCurrentIndex] = useState(0)
	const [isReviewing, setIsReviewing] = useState(false)

	const handleStartReview = (rule: ReviewRule) => {
		setSelectedRule(rule)
		setCurrentIndex(0)
		setIsReviewing(true)
	}

	const handleStopReview = () => {
		setIsReviewing(false)
		setCurrentIndex(0)
	}

	if (isReviewing) {
		return (
			<ReviewSession
				currentIndex={currentIndex}
				onIndexChange={setCurrentIndex}
				onStop={handleStopReview}
				selectedRule={selectedRule}
			/>
		)
	}

	return <ReviewDashboard onStartReview={handleStartReview} />
}

// Review Session Component
type ReviewSessionProps = {
	selectedRule: ReviewRule
	currentIndex: number
	onIndexChange: (index: number | ((prev: number) => number)) => void
	onStop: () => void
}

function ReviewSession({
	selectedRule,
	currentIndex,
	onIndexChange,
	onStop,
}: ReviewSessionProps) {
	const queryClient = useQueryClient()

	const {
		data: queueData,
		isLoading: isLoadingQueue,
		refetch: refetchQueue,
	} = useQuery({
		queryKey: ['review', 'queue', selectedRule],
		queryFn: () =>
			orpc.review.getQueue.call({
				rule: selectedRule,
				limit: 20,
			}),
	})

	const markReviewedMutation = useMutation({
		mutationFn: (entryId: string) => orpc.review.markReviewed.call({ entryId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['review', 'stats'] })
			if (queueData && currentIndex < queueData.items.length - 1) {
				onIndexChange((prev) => prev + 1)
			} else {
				toast.success('太棒了！你已完成本轮复习')
				onStop()
				refetchQueue()
			}
		},
		onError: () => {
			toast.error('标记失败')
		},
	})

	const handleMarkReviewed = () => {
		const currentEntry = queueData?.items[currentIndex]
		if (currentEntry) {
			markReviewedMutation.mutate(currentEntry.id)
		}
	}

	const handleSkip = () => {
		if (queueData && currentIndex < queueData.items.length - 1) {
			onIndexChange((prev) => prev + 1)
		} else {
			toast.info('已到达队列末尾')
		}
	}

	const currentEntry = queueData?.items[currentIndex] as Entry | undefined
	const totalInQueue = queueData?.items.length ?? 0
	const reviewedToday = queueData?.reviewedTodayCount ?? 0
	const ruleLabel = REVIEW_RULES.find((r) => r.key === selectedRule)?.label ?? ''

	return (
		<div className="container mx-auto max-w-3xl px-4 py-8">
			<ReviewSessionHeader
				currentIndex={currentIndex}
				onStop={onStop}
				reviewedToday={reviewedToday}
				ruleLabel={ruleLabel}
				totalInQueue={totalInQueue}
			/>

			<ReviewProgressBar currentIndex={currentIndex} totalInQueue={totalInQueue} />

			{isLoadingQueue ? (
				<div className="space-y-4">
					<Skeleton className="h-8 w-2/3" />
					<Skeleton className="h-48 w-full" />
				</div>
			) : null}

			{!isLoadingQueue && totalInQueue === 0 ? (
				<ReviewEmptyState
					onStop={onStop}
					ruleLabel={ruleLabel}
					selectedRule={selectedRule}
				/>
			) : null}

			{!isLoadingQueue && currentEntry ? (
				<ReviewCard
					entry={currentEntry}
					isMarkingReviewed={markReviewedMutation.isPending}
					onMarkReviewed={handleMarkReviewed}
					onSkip={handleSkip}
				/>
			) : null}
		</div>
	)
}

// Review Session Header
type ReviewSessionHeaderProps = {
	ruleLabel: string
	currentIndex: number
	totalInQueue: number
	reviewedToday: number
	onStop: () => void
}

function ReviewSessionHeader({
	ruleLabel,
	currentIndex,
	totalInQueue,
	reviewedToday,
	onStop,
}: ReviewSessionHeaderProps) {
	return (
		<div className="mb-6 flex items-center justify-between">
			<div>
				<h2 className="font-semibold text-lg">{ruleLabel} 复习</h2>
				<p className="text-muted-foreground text-sm">
					{currentIndex + 1} / {totalInQueue} · 今日已复习 {reviewedToday} 个
				</p>
			</div>
			<Button onClick={onStop} variant="outline">
				结束复习
			</Button>
		</div>
	)
}

// Review Progress Bar
type ReviewProgressBarProps = {
	currentIndex: number
	totalInQueue: number
}

function ReviewProgressBar({ currentIndex, totalInQueue }: ReviewProgressBarProps) {
	const progress = totalInQueue > 0 ? ((currentIndex + 1) / totalInQueue) * 100 : 0

	return (
		<div className="mb-8 h-2 overflow-hidden rounded-full bg-muted">
			<div
				className="h-full bg-primary transition-all"
				style={{ width: `${progress}%` }}
			/>
		</div>
	)
}

// Review Empty State
type ReviewEmptyStateProps = {
	selectedRule: ReviewRule
	ruleLabel: string
	onStop: () => void
}

function ReviewEmptyState({
	selectedRule,
	ruleLabel,
	onStop,
}: ReviewEmptyStateProps) {
	const message =
		selectedRule === 'all'
			? '今天的复习已全部完成'
			: `没有符合「${ruleLabel}」条件的条目需要复习`

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<HugeiconsIcon
				className="mb-4 size-12 text-green-500"
				icon={CheckmarkCircle02Icon}
			/>
			<p className="mb-2 font-medium text-lg">太棒了！</p>
			<p className="mb-4 text-muted-foreground">{message}</p>
			<Button onClick={onStop} variant="outline">
				返回
			</Button>
		</div>
	)
}

// Review Dashboard Component
type ReviewDashboardProps = {
	onStartReview: (rule: ReviewRule) => void
}

function ReviewDashboard({ onStartReview }: ReviewDashboardProps) {
	const { data: stats, isLoading: isLoadingStats } = useQuery({
		queryKey: ['review', 'stats'],
		queryFn: () => orpc.review.getTodayStats.call({}),
	})

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			<div className="mb-8 flex items-center gap-3">
				<div className="rounded-lg bg-primary/10 p-2">
					<HugeiconsIcon className="size-6 text-primary" icon={Rocket01Icon} />
				</div>
				<div>
					<h1 className="font-bold text-2xl">复习</h1>
					<p className="text-muted-foreground text-sm">通过间隔复习巩固学习内容</p>
				</div>
			</div>

			<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{isLoadingStats ? (
					<>
						<Skeleton className="h-24" />
						<Skeleton className="h-24" />
						<Skeleton className="h-24" />
						<Skeleton className="h-24" />
					</>
				) : (
					<>
						<StatsCard
							description="今日已复习"
							icon={CheckmarkCircle02Icon}
							iconColor="text-green-500"
							value={stats?.reviewedToday ?? 0}
						/>
						<StatsCard
							description="总条目数"
							icon={RefreshIcon}
							iconColor="text-blue-500"
							value={stats?.totalEntries ?? 0}
						/>
						<StatsCard
							description="收藏条目"
							icon={StarIcon}
							iconColor="text-amber-500"
							value={stats?.starredEntries ?? 0}
						/>
						<StatsCard
							description="未复习"
							icon={ViewIcon}
							iconColor="text-purple-500"
							value={stats?.unreviewedEntries ?? 0}
						/>
					</>
				)}
			</div>

			<h2 className="mb-4 font-semibold text-lg">选择复习模式</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				{REVIEW_RULES.map(({ key, label, icon, description }) => (
					<Card
						className="cursor-pointer transition-all hover:shadow-md"
						key={key}
						onClick={() => onStartReview(key)}
					>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<HugeiconsIcon className="size-5 text-primary" icon={icon} />
									<CardTitle className="text-base">{label}</CardTitle>
								</div>
								<HugeiconsIcon
									className="size-5 text-muted-foreground"
									icon={ArrowRight01Icon}
								/>
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-muted-foreground text-sm">{description}</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}

type StatsCardProps = {
	value: number
	description: string
	icon: IconSvgElement
	iconColor?: string
}

function StatsCard({ value, description, icon, iconColor }: StatsCardProps) {
	return (
		<Card>
			<CardContent className="flex items-center gap-4 pt-6">
				<div className="rounded-lg bg-muted p-2">
					<HugeiconsIcon className={cn('size-5', iconColor)} icon={icon} />
				</div>
				<div>
					<p className="font-bold text-2xl">{value}</p>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
			</CardContent>
		</Card>
	)
}

type ReviewCardProps = {
	entry: Entry
	onMarkReviewed: () => void
	onSkip: () => void
	isMarkingReviewed: boolean
}

function ReviewCard({
	entry,
	onMarkReviewed,
	onSkip,
	isMarkingReviewed,
}: ReviewCardProps) {
	const plainContent = entry.content.replace(/<[^>]*>/g, '').trim()

	return (
		<Card className="overflow-hidden">
			<CardHeader className="border-b bg-muted/30">
				<div className="flex items-start justify-between gap-2">
					<div>
						<CardTitle className="text-xl">{entry.title || '无标题'}</CardTitle>
						<p className="mt-1 text-muted-foreground text-sm">
							{entry.isInbox ? '收件箱' : '资料库'}
							{entry.isStarred ? ' · ⭐ 已收藏' : ''}
						</p>
					</div>
					<Link params={{ id: entry.id }} to="/entries/$id">
						<Button size="sm" variant="outline">
							查看详情
						</Button>
					</Link>
				</div>
			</CardHeader>
			<CardContent className="pt-6">
				<div className="mb-6 max-h-64 overflow-y-auto">
					<p className="whitespace-pre-wrap text-foreground leading-relaxed">
						{plainContent || '空白内容'}
					</p>
				</div>

				<div className="flex justify-center gap-4 border-t pt-6">
					<Button
						className="min-w-32"
						disabled={isMarkingReviewed}
						onClick={onSkip}
						variant="outline"
					>
						跳过
					</Button>
					<Button
						className="min-w-32"
						disabled={isMarkingReviewed}
						onClick={onMarkReviewed}
					>
						{isMarkingReviewed ? (
							'标记中...'
						) : (
							<>
								<HugeiconsIcon
									className="mr-2 size-4"
									icon={CheckmarkCircle02Icon}
								/>
								已复习
							</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
