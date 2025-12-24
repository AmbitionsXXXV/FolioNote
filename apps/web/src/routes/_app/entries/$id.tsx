import {
	ArchiveIcon,
	ArrowLeft01Icon,
	Delete02Icon,
	InboxIcon,
	PinIcon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import {
	createRefCommandWithEvent,
	getCurrentEditor,
	insertEntryRef,
} from '@/components/editor/ref-command'
import { createSourceCommandWithEvent } from '@/components/editor/source-command'
import { createTagCommand } from '@/components/editor/tag-command'
import { EntryEditor } from '@/components/entry-editor'
import { EntryPicker, type EntryPickerRef } from '@/components/entry-picker'
import { EntrySources, type EntrySourcesRef } from '@/components/entry-sources'
import { EntryTags, type EntryTagsRef } from '@/components/entry-tags'
import { SaveStatusIndicator } from '@/components/save-status-indicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { type SaveStatus, useAutoSave } from '@/hooks/use-auto-save'
import { client, orpc } from '@/utils/orpc'

export const Route = createFileRoute('/_app/entries/$id')({
	// 启用 SSR，条目页面需要 SEO（便于分享）
	ssr: true,

	// SSR loader - 服务端预加载条目数据
	loader: async ({ params }) => {
		const entry = await client.entries.get({ id: params.id })
		return { entry }
	},

	// 动态 SEO head 配置
	head: ({ loaderData }) => {
		const entry = loaderData?.entry
		const title = entry?.title || 'Untitled'
		// 从 contentJson 提取纯文本摘要用于 description
		const getDescription = () => {
			if (!entry?.contentJson) return `View and edit: ${title}`
			try {
				const content = JSON.parse(entry.contentJson)
				// 提取前 160 个字符作为描述
				const text =
					content?.content
						?.map((node: { type: string; content?: Array<{ text?: string }> }) =>
							node.type === 'paragraph'
								? node.content?.map((c) => c.text).join('')
								: ''
						)
						.join(' ')
						.slice(0, 160) || `View and edit: ${title}`
				return text
			} catch {
				return `View and edit: ${title}`
			}
		}

		return {
			meta: [
				{
					title: `${title} - FolioNote`,
				},
				{
					name: 'description',
					content: getDescription(),
				},
				{
					property: 'og:title',
					content: title,
				},
				{
					property: 'og:description',
					content: getDescription(),
				},
				{
					property: 'og:type',
					content: 'article',
				},
				{
					name: 'robots',
					content: 'noindex', // 私有条目不索引
				},
			],
		}
	},

	component: EntryEditPage,
})

/**
 * 更新条目的数据类型
 */
type UpdateEntryData = {
	id: string
	title?: string
	contentJson?: string
	isInbox?: boolean
	isStarred?: boolean
	isPinned?: boolean
	expectedVersion?: string
}

/**
 * Render the entry editing UI for the current route id.
 *
 * Provides editable title and content, and actions to move the entry between inbox and library, toggle star and pin state, and delete the entry. Shows a loading spinner while fetching and a not-found fallback when the entry is missing.
 *
 * @returns The entry editor page UI element for the current entry.
 */
function EntryEditPage() {
	const { t } = useTranslation()
	const { id } = Route.useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const entryTagsRef = useRef<EntryTagsRef>(null)
	const entrySourcesRef = useRef<EntrySourcesRef>(null)
	const entryPickerRef = useRef<EntryPickerRef>(null)

	// 使用 loader 预加载的数据
	const { entry: initialEntry } = Route.useLoaderData()

	// 使用 React Query 保持数据同步，loader 数据作为初始值
	const { data: entry, isLoading } = useQuery({
		queryKey: ['entries', id],
		queryFn: () => client.entries.get({ id }),
		initialData: initialEntry,
		// 避免首次渲染时重复请求
		staleTime: 5000,
	})

	// Local state for optimistic updates
	const [localTitle, setLocalTitle] = useState<string | null>(null)
	const [localContent, setLocalContent] = useState<string | null>(null)
	// 跟踪当前版本号
	const [currentVersion, setCurrentVersion] = useState<string>('1')
	// 删除确认对话框状态
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// 当 entry 加载完成时，更新版本号
	useEffect(() => {
		if (entry?.version) {
			setCurrentVersion(entry.version)
		}
	}, [entry?.version])

	// 自动保存 hook
	const { status: saveStatus, save: autoSave } = useAutoSave<UpdateEntryData>({
		onSave: async (data) => {
			const result = await orpc.entries.update.call(data)
			// 更新版本号
			if (result.version) {
				setCurrentVersion(result.version)
			}
			queryClient.invalidateQueries({ queryKey: ['entries'] })
		},
		debounceMs: 1000,
		savedDurationMs: 2000,
	})

	// Create tag command for slash menu
	const tagCommand = useMemo(
		() =>
			createTagCommand(
				{
					getTags: () => entryTagsRef.current?.getTags() ?? [],
					onAddTag: (tagId) => {
						entryTagsRef.current?.addTag(tagId)
					},
				},
				t
			),
		[t]
	)

	// Create source command for slash menu
	const sourceCommand = useMemo(() => createSourceCommandWithEvent(t), [t])

	// Create ref command for slash menu
	const refCommand = useMemo(() => createRefCommandWithEvent(), [])

	const additionalCommands = useMemo(
		() => [tagCommand, sourceCommand, refCommand],
		[tagCommand, sourceCommand, refCommand]
	)

	// Listen for custom events from slash commands
	useEffect(() => {
		const handleOpenSourcePicker = () => {
			entrySourcesRef.current?.openSourcePicker()
		}

		const handleOpenEntryPicker = () => {
			entryPickerRef.current?.open()
		}

		document.addEventListener(
			'folio-note:open-source-picker',
			handleOpenSourcePicker
		)
		document.addEventListener('folio-note:open-entry-picker', handleOpenEntryPicker)

		return () => {
			document.removeEventListener(
				'folio-note:open-source-picker',
				handleOpenSourcePicker
			)
			document.removeEventListener(
				'folio-note:open-entry-picker',
				handleOpenEntryPicker
			)
		}
	}, [])

	// Update mutation for non-content updates (star, pin, inbox)
	const updateMutation = useMutation({
		mutationFn: (data: UpdateEntryData) => orpc.entries.update.call(data),
		onSuccess: (result) => {
			if (result.version) {
				setCurrentVersion(result.version)
			}
			queryClient.invalidateQueries({ queryKey: ['entries'] })
		},
		onError: (error) => {
			// 检查是否是版本冲突错误
			if (error.message?.includes('Version conflict')) {
				toast.error(t('entry.versionConflict'))
				// 重新获取最新数据
				queryClient.invalidateQueries({ queryKey: ['entries', id] })
			} else {
				toast.error(t('entry.saveFailed'))
			}
		},
	})

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: (data: { id: string }) => orpc.entries.delete.call(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
			toast.success(t('entry.movedToTrash'))
			navigate({ to: entry?.isInbox ? '/inbox' : '/library' })
		},
	})

	// Handlers
	const handleTitleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newTitle = e.target.value
			setLocalTitle(newTitle)
			autoSave({
				id,
				title: newTitle,
				expectedVersion: currentVersion,
			})
		},
		[id, autoSave, currentVersion]
	)

	const handleContentChange = useCallback(
		(_html: string, json: string) => {
			setLocalContent(json)
			autoSave({
				id,
				contentJson: json,
				expectedVersion: currentVersion,
			})
		},
		[id, autoSave, currentVersion]
	)

	const handleToggleStar = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate({
			id,
			isStarred: !entry.isStarred,
			expectedVersion: currentVersion,
		})
	}, [entry, id, updateMutation, currentVersion])

	const handleTogglePin = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate({
			id,
			isPinned: !entry.isPinned,
			expectedVersion: currentVersion,
		})
	}, [entry, id, updateMutation, currentVersion])

	const handleMoveToLibrary = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate(
			{ id, isInbox: false, expectedVersion: currentVersion },
			{
				onSuccess: () => {
					toast.success(t('entry.movedToLibrary'))
				},
			}
		)
	}, [entry, id, updateMutation, currentVersion, t])

	const handleMoveToInbox = useCallback(() => {
		if (!entry) {
			return
		}
		updateMutation.mutate(
			{ id, isInbox: true, expectedVersion: currentVersion },
			{
				onSuccess: () => {
					toast.success(t('entry.movedToInbox'))
				},
			}
		)
	}, [entry, id, updateMutation, currentVersion, t])

	const handleDeleteClick = useCallback(() => {
		setShowDeleteDialog(true)
	}, [])

	const handleConfirmDelete = useCallback(() => {
		deleteMutation.mutate(
			{ id },
			{
				onSuccess: () => {
					setShowDeleteDialog(false)
				},
			}
		)
	}, [deleteMutation, id])

	const handleGoBack = useCallback(() => {
		navigate({ to: entry?.isInbox ? '/inbox' : '/library' })
	}, [entry, navigate])

	// 计算显示的保存状态
	const displaySaveStatus: SaveStatus = updateMutation.isPending
		? 'saving'
		: saveStatus

	if (isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Spinner className="size-8 text-muted-foreground" />
			</div>
		)
	}

	if (!entry) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<p className="text-muted-foreground">{t('entry.notExist')}</p>
				<Button onClick={() => navigate({ to: '/inbox' })} variant="outline">
					{t('entry.backToInbox')}
				</Button>
			</div>
		)
	}

	const title = localTitle ?? entry.title
	// 使用 contentJson
	const editorContent = localContent ?? entry.contentJson ?? ''

	return (
		<div className="container mx-auto max-w-4xl px-4 py-6">
			{/* Header toolbar */}
			<div className="mb-6 flex items-center justify-between">
				<Button onClick={handleGoBack} size="sm" variant="ghost">
					<HugeiconsIcon className="mr-2 size-4" icon={ArrowLeft01Icon} />
					{t('common.back')}
				</Button>

				<div className="flex items-center gap-1">
					{/* Save status indicator */}
					<SaveStatusIndicator className="mr-2" status={displaySaveStatus} />

					{/* Move to library/inbox */}
					{entry.isInbox ? (
						<Button
							onClick={handleMoveToLibrary}
							size="icon"
							title={t('entry.moveToLibrary')}
							variant="ghost"
						>
							<HugeiconsIcon className="size-4" icon={ArchiveIcon} />
						</Button>
					) : (
						<Button
							onClick={handleMoveToInbox}
							size="icon"
							title={t('entry.moveToInbox')}
							variant="ghost"
						>
							<HugeiconsIcon className="size-4" icon={InboxIcon} />
						</Button>
					)}

					{/* Star */}
					<Button
						onClick={handleToggleStar}
						size="icon"
						title={t('entry.starred')}
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
						title={t('entry.pinned')}
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
						onClick={handleDeleteClick}
						size="icon"
						title={t('common.delete')}
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
				placeholder={t('entry.title')}
				value={title}
			/>

			{/* Tags */}
			<div className="mb-4">
				<EntryTags entryId={id} ref={entryTagsRef} />
			</div>

			{/* Sources */}
			<div className="mb-4">
				<EntrySources entryId={id} ref={entrySourcesRef} />
			</div>

			{/* Editor */}
			<EntryEditor
				additionalCommands={additionalCommands}
				autoFocus
				content={editorContent}
				contentFormat="json"
				onChange={handleContentChange}
				placeholder={t('editor.placeholderWithSlash')}
			/>

			{/* Metadata footer */}
			<div className="mt-8 border-t pt-4 font-bold font-script text-muted-foreground text-sm">
				<p>
					{t('entry.createdAt')}{' '}
					{new Intl.DateTimeFormat(undefined, {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					}).format(new Date(entry.createdAt))}
				</p>
				<p>
					{t('entry.updatedAt')}{' '}
					{new Intl.DateTimeFormat(undefined, {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					}).format(new Date(entry.updatedAt))}
				</p>
			</div>

			{/* Entry picker dialog for /ref command */}
			<EntryPicker
				excludeId={id}
				onSelect={(selectedEntry) => {
					// Get the editor instance stored by the ref command
					const editor = getCurrentEditor()
					if (editor) {
						insertEntryRef(editor, selectedEntry)
					}
				}}
				ref={entryPickerRef}
			/>

			{/* Delete confirmation dialog */}
			<ConfirmDeleteDialog
				description={t('entry.deleteConfirmDesc')}
				isLoading={deleteMutation.isPending}
				onConfirm={handleConfirmDelete}
				onOpenChange={setShowDeleteDialog}
				open={showDeleteDialog}
				title={t('entry.deleteConfirmTitle')}
			/>
		</div>
	)
}
