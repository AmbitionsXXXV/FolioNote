import {
	ArchiveIcon,
	ArrowLeft01Icon,
	Delete02Icon,
	InboxIcon,
	Loading02Icon,
	PinIcon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createTagCommand } from '@/components/editor/tag-command'
import { EntryEditor } from '@/components/entry-editor'
import { EntryTags, type EntryTagsRef } from '@/components/entry-tags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getUser } from '@/functions/get-user'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/entries/$id')({
	component: EntryEditPage,
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

/**
 * Render the entry editing UI for the current route id.
 *
 * Provides editable title and content, and actions to move the entry between inbox and library, toggle star and pin state, and delete the entry. Shows a loading spinner while fetching and a not-found fallback when the entry is missing.
 *
 * @returns The entry editor page UI element for the current entry.
 */
function EntryEditPage() {
	const { id } = Route.useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const entryTagsRef = useRef<EntryTagsRef>(null)

	// Local state for optimistic updates
	const [localTitle, setLocalTitle] = useState<string | null>(null)
	const [localContent, setLocalContent] = useState<string | null>(null)

	// Fetch entry data
	const { data: entry, isLoading } = useQuery({
		queryKey: ['entries', id],
		queryFn: () => orpc.entries.get.call({ id }),
	})

	// Create tag command for slash menu
	const tagCommand = useMemo(
		() =>
			createTagCommand({
				getTags: () => entryTagsRef.current?.getTags() ?? [],
				onAddTag: (tagId) => {
					entryTagsRef.current?.addTag(tagId)
				},
			}),
		[]
	)

	const additionalCommands = useMemo(() => [tagCommand], [tagCommand])

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: (data: {
			id: string
			title?: string
			content?: string
			isInbox?: boolean
			isStarred?: boolean
			isPinned?: boolean
		}) => orpc.entries.update.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
		},
		onError: () => {
			toast.error('保存失败，请重试')
		},
	})

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: (data: { id: string }) => orpc.entries.delete.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
			toast.success('已移至回收站')
			navigate({ to: entry?.isInbox ? '/inbox' : '/library' })
		},
	})

	// Handlers
	const handleTitleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newTitle = e.target.value
			setLocalTitle(newTitle)
			updateMutation.mutate({ id, title: newTitle })
		},
		[id, updateMutation]
	)

	const handleContentChange = useCallback(
		(newContent: string) => {
			setLocalContent(newContent)
			updateMutation.mutate({ id, content: newContent })
		},
		[id, updateMutation]
	)

	const handleToggleStar = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate({ id, isStarred: !entry.isStarred })
	}, [entry, id, updateMutation])

	const handleTogglePin = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate({ id, isPinned: !entry.isPinned })
	}, [entry, id, updateMutation])

	const handleMoveToLibrary = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate(
			{ id, isInbox: false },
			{
				onSuccess: () => {
					toast.success('已移至资料库')
				},
			}
		)
	}, [entry, id, updateMutation])

	const handleMoveToInbox = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate(
			{ id, isInbox: true },
			{
				onSuccess: () => {
					toast.success('已移至收件箱')
				},
			}
		)
	}, [entry, id, updateMutation])

	const handleDelete = useCallback(() => {
		deleteMutation.mutate({ id })
	}, [deleteMutation, id])

	const handleGoBack = useCallback(() => {
		navigate({ to: entry?.isInbox ? '/inbox' : '/library' })
	}, [entry, navigate])

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<HugeiconsIcon
					className="size-8 animate-spin text-muted-foreground"
					icon={Loading02Icon}
				/>
			</div>
		)
	}

	if (!entry) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<p className="text-muted-foreground">笔记不存在或已被删除</p>
				<Button onClick={() => navigate({ to: '/inbox' })} variant="outline">
					返回收件箱
				</Button>
			</div>
		)
	}

	const title = localTitle ?? entry.title
	const content = localContent ?? entry.content

	return (
		<div className="container mx-auto max-w-4xl px-4 py-6">
			{/* Header toolbar */}
			<div className="mb-6 flex items-center justify-between">
				<Button onClick={handleGoBack} size="sm" variant="ghost">
					<HugeiconsIcon className="mr-2 size-4" icon={ArrowLeft01Icon} />
					返回
				</Button>

				<div className="flex items-center gap-1">
					{/* Save indicator */}
					{updateMutation.isPending ? (
						<span className="mr-2 flex items-center gap-1 text-muted-foreground text-xs">
							<HugeiconsIcon className="size-3 animate-spin" icon={Loading02Icon} />
							保存中...
						</span>
					) : null}

					{/* Move to library/inbox */}
					{entry.isInbox ? (
						<Button
							onClick={handleMoveToLibrary}
							size="icon"
							title="移至资料库"
							variant="ghost"
						>
							<HugeiconsIcon className="size-4" icon={ArchiveIcon} />
						</Button>
					) : (
						<Button
							onClick={handleMoveToInbox}
							size="icon"
							title="移至收件箱"
							variant="ghost"
						>
							<HugeiconsIcon className="size-4" icon={InboxIcon} />
						</Button>
					)}

					{/* Star */}
					<Button
						onClick={handleToggleStar}
						size="icon"
						title={entry.isStarred ? '取消收藏' : '收藏'}
						variant="ghost"
					>
						<HugeiconsIcon
							className={`size-4 ${
								entry.isStarred ? 'fill-amber-500 text-amber-500' : ''
							}`}
							icon={StarIcon}
						/>
					</Button>

					{/* Pin */}
					<Button
						onClick={handleTogglePin}
						size="icon"
						title={entry.isPinned ? '取消置顶' : '置顶'}
						variant="ghost"
					>
						<HugeiconsIcon
							className={`size-4 ${
								entry.isPinned ? 'fill-primary text-primary' : ''
							}`}
							icon={PinIcon}
						/>
					</Button>

					{/* Delete */}
					<Button
						className="text-destructive hover:text-destructive"
						onClick={handleDelete}
						size="icon"
						title="删除"
						variant="ghost"
					>
						<HugeiconsIcon className="size-4" icon={Delete02Icon} />
					</Button>
				</div>
			</div>

			{/* Title input */}
			<Input
				className="mb-4 border-none font-bold text-2xl shadow-none focus-visible:ring-0"
				onChange={handleTitleChange}
				placeholder="标题"
				value={title}
			/>

			{/* Tags */}
			<div className="mb-4">
				<EntryTags entryId={id} ref={entryTagsRef} />
			</div>

			{/* Editor */}
			<EntryEditor
				additionalCommands={additionalCommands}
				autoFocus
				content={content}
				onChange={handleContentChange}
				placeholder="开始写作... 输入 / 打开命令菜单"
			/>

			{/* Metadata footer */}
			<div className="mt-8 border-t pt-4 text-muted-foreground text-xs">
				<p>
					创建于{' '}
					{new Intl.DateTimeFormat('zh-CN', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					}).format(new Date(entry.createdAt))}
				</p>
				<p>
					最后更新于{' '}
					{new Intl.DateTimeFormat('zh-CN', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					}).format(new Date(entry.updatedAt))}
				</p>
			</div>
		</div>
	)
}
