import {
	Add01Icon,
	Cancel01Icon,
	Delete02Icon,
	Edit02Icon,
	Tag01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
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

export const Route = createFileRoute('/_app/tags')({
	// SPA 模式 - 标签管理页面无需 SSR
	ssr: false,
	component: TagsPage,
})

function TagsPage() {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingTag, setEditingTag] = useState<Tag | null>(null)
	const [tagName, setTagName] = useState('')
	const [tagColor, setTagColor] = useState<string | null>(null)
	// 删除确认对话框状态
	const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

	// Fetch all tags
	const {
		data: tagsData,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: ['tags'],
		queryFn: () => orpc.tags.list.call({}),
	})
	const tags = tagsData ?? []

	// Create tag mutation
	const createMutation = useMutation({
		mutationFn: (data: { name: string; color?: string }) =>
			orpc.tags.create.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			toast.success(t('tag.created'))
			handleCloseDialog()
		},
		onError: (mutationError: Error) => {
			if (mutationError.message.includes('already exists')) {
				toast.error(t('tag.nameExists'))
			} else {
				toast.error(t('tag.createFailed'))
			}
		},
	})

	// Update tag mutation
	const updateMutation = useMutation({
		mutationFn: (data: { id: string; name?: string; color?: string | null }) =>
			orpc.tags.update.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			toast.success(t('tag.updated'))
			handleCloseDialog()
		},
		onError: (mutationError: Error) => {
			if (mutationError.message.includes('already exists')) {
				toast.error(t('tag.nameExists'))
			} else {
				toast.error(t('tag.updateFailed'))
			}
		},
	})

	// Delete tag mutation
	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.tags.delete.call({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			toast.success(t('tag.deleted'))
			setDeleteTarget(null)
		},
		onError: () => {
			toast.error(t('tag.deleteFailed'))
		},
	})

	const handleOpenCreate = () => {
		setEditingTag(null)
		setTagName('')
		setTagColor(
			PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] ?? null
		)
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

	const handleDeleteClick = useCallback((tag: Tag) => {
		setDeleteTarget(tag)
	}, [])

	const handleConfirmDelete = useCallback(() => {
		if (deleteTarget) {
			deleteMutation.mutate(deleteTarget.id)
		}
	}, [deleteTarget, deleteMutation])

	const isPending = createMutation.isPending || updateMutation.isPending

	const getSubmitButtonText = (editing: Tag | null) =>
		editing ? t('common.save') : t('common.create')

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<HugeiconsIcon className="size-6 text-primary" icon={Tag01Icon} />
					</div>
					<div>
						<h1 className="font-bold text-2xl">{t('tag.tags')}</h1>
						<p className="text-muted-foreground text-sm">{t('tag.noTags')}</p>
					</div>
				</div>

				<Button onClick={handleOpenCreate}>
					<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
					{t('tag.newTag')}
				</Button>
			</div>

			{/* Tag list */}
			<TagListContent
				error={error}
				handleDelete={handleDeleteClick}
				handleOpenCreate={handleOpenCreate}
				handleOpenEdit={handleOpenEdit}
				isError={isError}
				isLoading={isLoading}
				refetch={refetch}
				t={t}
				tags={tags}
			/>

			{/* Create/Edit dialog */}
			<Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingTag ? t('tag.editTag') : t('tag.newTag')}
						</DialogTitle>
					</DialogHeader>

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="tag-name">{t('tag.tagName')}</Label>
							<Input
								autoFocus
								disabled={isPending}
								id="tag-name"
								maxLength={50}
								onChange={(e) => setTagName(e.target.value)}
								placeholder={t('tag.tagName')}
								value={tagName}
							/>
						</div>

						<div className="space-y-2">
							<Label>{t('tag.tagColor')}</Label>
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
							<Label>{t('tag.preview')}</Label>
							<div className="flex items-center gap-2">
								<Badge
									style={tagColor ? { backgroundColor: tagColor } : undefined}
									variant="secondary"
								>
									{tagName || t('tag.tagName')}
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
								{t('common.cancel')}
							</Button>
							<Button disabled={!tagName.trim() || isPending} type="submit">
								{isPending ? t('common.loading') : getSubmitButtonText(editingTag)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation dialog */}
			<ConfirmDeleteDialog
				description={t('tag.deleteConfirmDesc', { name: deleteTarget?.name || '' })}
				isLoading={deleteMutation.isPending}
				onConfirm={handleConfirmDelete}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				open={!!deleteTarget}
				title={t('tag.deleteConfirmTitle')}
			/>
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

type TagListContentProps = {
	isLoading: boolean
	isError: boolean
	error: Error | null
	tags: Tag[]
	handleOpenCreate: () => void
	handleOpenEdit: (tag: Tag) => void
	handleDelete: (tag: Tag) => void
	refetch: () => void
	t: (key: string) => string
}

function TagListContent({
	isLoading,
	isError,
	error,
	tags,
	handleOpenCreate,
	handleOpenEdit,
	handleDelete,
	refetch,
	t,
}: TagListContentProps) {
	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
			</div>
		)
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<HugeiconsIcon
					className="mb-4 size-12 text-destructive/50"
					icon={Tag01Icon}
				/>
				<p className="mb-2 font-medium text-destructive">{t('common.error')}</p>
				<p className="mb-4 text-muted-foreground text-sm">
					{error?.message ?? t('common.unknownError')}
				</p>
				<Button onClick={() => refetch()} variant="outline">
					{t('common.retry')}
				</Button>
			</div>
		)
	}

	if (tags.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<HugeiconsIcon
					className="mb-4 size-12 text-muted-foreground/50"
					icon={Tag01Icon}
				/>
				<p className="mb-2 font-medium text-muted-foreground">{t('tag.noTags')}</p>
				<p className="mb-4 text-muted-foreground text-sm">{t('tag.addTag')}</p>
				<Button onClick={handleOpenCreate} variant="outline">
					<HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
					{t('tag.newTag')}
				</Button>
			</div>
		)
	}

	return (
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
	)
}
