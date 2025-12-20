import {
	Add01Icon,
	Cancel01Icon,
	Delete02Icon,
	Edit02Icon,
	Tag01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser } from '@/functions/get-user'
import { orpc } from '@/utils/orpc'

type Tag = {
	id: string
	name: string
	color: string | null
	createdAt: Date | string
	updatedAt: Date | string
}

// Preset colors for tags
const PRESET_COLORS = [
	'#ef4444', // red
	'#f97316', // orange
	'#f59e0b', // amber
	'#eab308', // yellow
	'#84cc16', // lime
	'#22c55e', // green
	'#14b8a6', // teal
	'#06b6d4', // cyan
	'#0ea5e9', // sky
	'#3b82f6', // blue
	'#6366f1', // indigo
	'#8b5cf6', // violet
	'#a855f7', // purple
	'#d946ef', // fuchsia
	'#ec4899', // pink
	'#f43f5e', // rose
]

export const Route = createFileRoute('/tags')({
	component: TagsPage,
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

function TagsPage() {
	const queryClient = useQueryClient()
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingTag, setEditingTag] = useState<Tag | null>(null)
	const [tagName, setTagName] = useState('')
	const [tagColor, setTagColor] = useState<string | null>(null)

	// Fetch all tags
	const { data: tags = [], isLoading } = useQuery({
		queryKey: ['tags'],
		queryFn: () => orpc.tags.list.call({}),
	})

	// Create tag mutation
	const createMutation = useMutation({
		mutationFn: (data: { name: string; color?: string }) =>
			orpc.tags.create.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			toast.success('标签已创建')
			handleCloseDialog()
		},
		onError: (error: Error) => {
			if (error.message.includes('already exists')) {
				toast.error('标签名称已存在')
			} else {
				toast.error('创建失败')
			}
		},
	})

	// Update tag mutation
	const updateMutation = useMutation({
		mutationFn: (data: { id: string; name?: string; color?: string | null }) =>
			orpc.tags.update.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			toast.success('标签已更新')
			handleCloseDialog()
		},
		onError: (error: Error) => {
			if (error.message.includes('already exists')) {
				toast.error('标签名称已存在')
			} else {
				toast.error('更新失败')
			}
		},
	})

	// Delete tag mutation
	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.tags.delete.call({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			toast.success('标签已删除')
		},
		onError: () => {
			toast.error('删除失败')
		},
	})

	const handleOpenCreate = () => {
		setEditingTag(null)
		setTagName('')
		setTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
		setIsDialogOpen(true)
	}

	const handleOpenEdit = (tag: Tag) => {
		setEditingTag(tag)
		setTagName(tag.name)
		setTagColor(tag.color)
		setIsDialogOpen(true)
	}

	const handleCloseDialog = () => {
		setIsDialogOpen(false)
		setEditingTag(null)
		setTagName('')
		setTagColor(null)
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const trimmedName = tagName.trim()
		if (!trimmedName) return

		if (editingTag) {
			updateMutation.mutate({
				id: editingTag.id,
				name: trimmedName,
				color: tagColor,
			})
		} else {
			createMutation.mutate({
				name: trimmedName,
				color: tagColor ?? undefined,
			})
		}
	}

	const handleDelete = (tag: Tag) => {
		// Direct delete without confirmation for better UX
		deleteMutation.mutate(tag.id)
	}

	const isPending = createMutation.isPending || updateMutation.isPending

	const getSubmitButtonText = (editing: Tag | null) => (editing ? '保存' : '创建')

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<HugeiconsIcon className="size-6 text-primary" icon={Tag01Icon} />
					</div>
					<div>
						<h1 className="font-bold text-2xl">标签</h1>
						<p className="text-muted-foreground text-sm">管理笔记标签</p>
					</div>
				</div>

				<Button onClick={handleOpenCreate}>
					<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
					新建标签
				</Button>
			</div>

			{/* Tag list */}
			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
				</div>
			) : null}

			{!isLoading && tags.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<HugeiconsIcon
						className="mb-4 size-12 text-muted-foreground/50"
						icon={Tag01Icon}
					/>
					<p className="mb-2 font-medium text-muted-foreground">暂无标签</p>
					<p className="mb-4 text-muted-foreground text-sm">
						创建标签来组织你的笔记
					</p>
					<Button onClick={handleOpenCreate} variant="outline">
						<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
						创建第一个标签
					</Button>
				</div>
			) : null}

			{!isLoading && tags.length > 0 ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{tags.map((tag: Tag) => (
						<TagCard
							key={tag.id}
							onDelete={() => handleDelete(tag)}
							onEdit={() => handleOpenEdit(tag)}
							tag={tag}
						/>
					))}
				</div>
			) : null}

			{/* Create/Edit dialog */}
			<Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
					</DialogHeader>

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="tag-name">名称</Label>
							<Input
								autoFocus
								disabled={isPending}
								id="tag-name"
								maxLength={50}
								onChange={(e) => setTagName(e.target.value)}
								placeholder="输入标签名称"
								value={tagName}
							/>
						</div>

						<div className="space-y-2">
							<Label>颜色</Label>
							<div className="flex flex-wrap gap-2">
								{/* No color option */}
								<button
									className={`flex size-8 items-center justify-center rounded-full border-2 transition-all ${
										tagColor === null
											? 'border-primary ring-2 ring-primary/30'
											: 'border-border hover:border-muted-foreground'
									}`}
									onClick={() => setTagColor(null)}
									type="button"
								>
									<HugeiconsIcon
										className="size-4 text-muted-foreground"
										icon={Cancel01Icon}
									/>
								</button>
								{/* Preset colors */}
								{PRESET_COLORS.map((color) => (
									<button
										className={`size-8 rounded-full border-2 transition-all ${
											tagColor === color
												? 'border-primary ring-2 ring-primary/30'
												: 'border-transparent hover:scale-110'
										}`}
										key={color}
										onClick={() => setTagColor(color)}
										style={{ backgroundColor: color }}
										type="button"
									/>
								))}
							</div>
						</div>

						{/* Preview */}
						<div className="space-y-2">
							<Label>预览</Label>
							<div className="flex items-center gap-2">
								<Badge
									style={tagColor ? { backgroundColor: tagColor } : undefined}
									variant="secondary"
								>
									{tagName || '标签名称'}
								</Badge>
							</div>
						</div>

						<DialogFooter>
							<Button
								disabled={isPending}
								onClick={handleCloseDialog}
								type="button"
								variant="outline"
							>
								取消
							</Button>
							<Button disabled={!tagName.trim() || isPending} type="submit">
								{isPending ? '保存中...' : getSubmitButtonText(editingTag)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}

type TagCardProps = {
	tag: Tag
	onEdit: () => void
	onDelete: () => void
}

function TagCard({ tag, onEdit, onDelete }: TagCardProps) {
	const queryClient = useQueryClient()

	// Fetch entries count for this tag
	const { data: countData } = useQuery({
		queryKey: ['tags', tag.id, 'entriesCount'],
		queryFn: () => orpc.tags.getEntriesCount.call({ id: tag.id }),
	})

	const entriesCount = countData?.count ?? 0

	return (
		<Card className="group relative transition-all hover:shadow-md">
			<Link
				className="block"
				onClick={() => {
					// Invalidate library queries to ensure fresh data with tag filter
					queryClient.invalidateQueries({ queryKey: ['entries', 'library'] })
				}}
				search={{ tagId: tag.id }}
				to="/library"
			>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2">
							{tag.color ? (
								<span
									className="size-4 rounded-full"
									style={{ backgroundColor: tag.color }}
								/>
							) : (
								<HugeiconsIcon
									className="size-4 text-muted-foreground"
									icon={Tag01Icon}
								/>
							)}
							<h3 className="font-medium text-foreground">{tag.name}</h3>
						</div>
						<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							<Button
								className="h-7 w-7"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onEdit()
								}}
								size="icon"
								variant="ghost"
							>
								<HugeiconsIcon className="size-3.5" icon={Edit02Icon} />
							</Button>
							<Button
								className="h-7 w-7 text-destructive hover:text-destructive"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onDelete()
								}}
								size="icon"
								variant="ghost"
							>
								<HugeiconsIcon className="size-3.5" icon={Delete02Icon} />
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="text-muted-foreground text-sm">{entriesCount} 个条目</p>
				</CardContent>
			</Link>
		</Card>
	)
}
