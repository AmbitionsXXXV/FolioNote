import { Cancel01Icon, PlusSignIcon, Tag01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Ref, useImperativeHandle, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { orpc } from '@/utils/orpc'

type Tag = {
	id: string
	name: string
	color: string | null
}

/**
 * Ref methods for EntryTags component
 */
export type EntryTagsRef = {
	openTagPicker: () => void
	getTags: () => Tag[]
	addTag: (tagId: string) => void
}

type EntryTagsProps = {
	entryId: string
	ref?: Ref<EntryTagsRef>
}

/**
 * Component for managing tags on an entry.
 * Displays current tags and allows adding/removing tags.
 */
export function EntryTags({ entryId, ref }: EntryTagsProps) {
	const queryClient = useQueryClient()
	const [isOpen, setIsOpen] = useState(false)
	const [newTagName, setNewTagName] = useState('')

	// Fetch entry's current tags
	const { data: entryTags = [] } = useQuery({
		queryKey: ['entries', entryId, 'tags'],
		queryFn: () => orpc.entries.getTags.call({ id: entryId }),
	})

	// Fetch all user tags
	const { data: allTags = [] } = useQuery({
		queryKey: ['tags'],
		queryFn: () => orpc.tags.list.call({}),
	})

	// Add tag mutation
	const addTagMutation = useMutation({
		mutationFn: (tagId: string) => orpc.entries.addTag.call({ entryId, tagId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries', entryId, 'tags'] })
		},
		onError: () => {
			toast.error('添加标签失败')
		},
	})

	// Remove tag mutation
	const removeTagMutation = useMutation({
		mutationFn: (tagId: string) => orpc.entries.removeTag.call({ entryId, tagId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries', entryId, 'tags'] })
		},
		onError: () => {
			toast.error('移除标签失败')
		},
	})

	// Create new tag mutation
	const createTagMutation = useMutation({
		mutationFn: (name: string) => orpc.tags.create.call({ name }),
		onSuccess: (newTag) => {
			queryClient.invalidateQueries({ queryKey: ['tags'] })
			// Also add the new tag to the entry
			addTagMutation.mutate(newTag.id)
			setNewTagName('')
		},
		onError: (error: Error) => {
			if (error.message.includes('already exists')) {
				toast.error('标签已存在')
			} else {
				toast.error('创建标签失败')
			}
		},
	})

	const handleAddTag = (tagId: string) => {
		addTagMutation.mutate(tagId)
	}

	const handleRemoveTag = (tagId: string) => {
		removeTagMutation.mutate(tagId)
	}

	const handleCreateTag = () => {
		const trimmedName = newTagName.trim()
		if (!trimmedName) return

		// Check if tag already exists
		const existingTag = allTags.find(
			(t: Tag) => t.name.toLowerCase() === trimmedName.toLowerCase()
		)
		if (existingTag) {
			// If exists, just add it to the entry
			handleAddTag(existingTag.id)
			setNewTagName('')
		} else {
			// Create new tag
			createTagMutation.mutate(trimmedName)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			handleCreateTag()
		}
	}

	// Expose methods via ref
	useImperativeHandle(ref, () => ({
		openTagPicker: () => setIsOpen(true),
		getTags: () => allTags as Tag[],
		addTag: (tagId: string) => handleAddTag(tagId),
	}))

	// Filter out tags that are already on the entry
	const entryTagIds = new Set(entryTags.map((t: Tag) => t.id))
	const availableTags = allTags.filter((t: Tag) => !entryTagIds.has(t.id))

	return (
		<div className="flex flex-wrap items-center gap-2">
			{/* Display current tags */}
			{entryTags.map((tag: Tag) => (
				<Badge
					className="flex items-center gap-1 pr-1"
					key={tag.id}
					style={tag.color ? { backgroundColor: tag.color } : undefined}
					variant="secondary"
				>
					<span>{tag.name}</span>
					<button
						className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
						disabled={removeTagMutation.isPending}
						onClick={() => handleRemoveTag(tag.id)}
						title="移除标签"
						type="button"
					>
						<HugeiconsIcon className="size-3" icon={Cancel01Icon} />
					</button>
				</Badge>
			))}

			{/* Add tag button */}
			<Popover onOpenChange={setIsOpen} open={isOpen}>
				<PopoverTrigger asChild>
					<Button className="h-6 gap-1 px-2 text-xs" size="sm" variant="ghost">
						<HugeiconsIcon className="size-3" icon={Tag01Icon} />
						添加标签
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-64 p-2">
					{/* Create new tag input */}
					<div className="mb-2 flex gap-1">
						<Input
							className="h-8 text-sm"
							onChange={(e) => setNewTagName(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="新建标签..."
							value={newTagName}
						/>
						<Button
							className="h-8 px-2"
							disabled={!newTagName.trim() || createTagMutation.isPending}
							onClick={handleCreateTag}
							size="sm"
						>
							<HugeiconsIcon className="size-4" icon={PlusSignIcon} />
						</Button>
					</div>

					{/* Available tags list */}
					{availableTags.length > 0 ? (
						<div className="max-h-48 space-y-1 overflow-y-auto">
							<p className="mb-1 text-muted-foreground text-xs">现有标签</p>
							{availableTags.map((tag: Tag) => (
								<button
									className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
									disabled={addTagMutation.isPending}
									key={tag.id}
									onClick={() => {
										handleAddTag(tag.id)
										setIsOpen(false)
									}}
									type="button"
								>
									{tag.color ? (
										<span
											className="size-3 rounded-full"
											style={{ backgroundColor: tag.color }}
										/>
									) : (
										<HugeiconsIcon
											className="size-3 text-muted-foreground"
											icon={Tag01Icon}
										/>
									)}
									<span>{tag.name}</span>
								</button>
							))}
						</div>
					) : null}

					{/* Empty state messages */}
					{availableTags.length === 0 && entryTags.length > 0 && (
						<p className="py-2 text-center text-muted-foreground text-xs">
							所有标签已添加
						</p>
					)}
					{availableTags.length === 0 &&
						entryTags.length === 0 &&
						allTags.length === 0 && (
							<p className="py-2 text-center text-muted-foreground text-xs">
								暂无标签，输入名称创建
							</p>
						)}
				</PopoverContent>
			</Popover>
		</div>
	)
}
