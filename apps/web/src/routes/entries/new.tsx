import { ArrowLeft01Icon, Loading02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { EntryEditor } from '@/components/entry-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getUser } from '@/functions/get-user'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/entries/new')({
	component: NewEntryPage,
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
 * Page for composing a new entry and saving it to the library.
 *
 * Presents a title input and rich editor, lets the user save a new entry (which invalidates the entries cache, shows success or error toasts, and navigates to the new entry's edit page), and provides a back button to return to the library.
 *
 * @returns The rendered JSX for the New Entry page component
 */
function NewEntryPage() {
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const [title, setTitle] = useState('')
	const [content, setContent] = useState('')

	// Create mutation
	const createMutation = useMutation({
		mutationFn: (data: { title?: string; content?: string; isInbox?: boolean }) =>
			orpc.entries.create.call(data),
		onSuccess: (entry) => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
			toast.success('笔记已创建')
			// Navigate to the new entry's edit page
			if (entry) {
				navigate({ to: '/entries/$id', params: { id: entry.id } })
			}
		},
		onError: () => {
			toast.error('创建失败，请重试')
		},
	})

	const handleSave = useCallback(() => {
		createMutation.mutate({
			title,
			content,
			isInbox: false, // New entries from this page go to library
		})
	}, [createMutation, title, content])

	const handleGoBack = useCallback(() => {
		navigate({ to: '/library' })
	}, [navigate])

	return (
		<div className="container mx-auto max-w-4xl px-4 py-6">
			{/* Header toolbar */}
			<div className="mb-6 flex items-center justify-between">
				<Button onClick={handleGoBack} size="sm" variant="ghost">
					<HugeiconsIcon className="mr-2 size-4" icon={ArrowLeft01Icon} />
					返回
				</Button>

				<Button
					disabled={createMutation.isPending || !(title.trim() || content.trim())}
					onClick={handleSave}
				>
					{createMutation.isPending ? (
						<>
							<HugeiconsIcon
								className="mr-2 size-4 animate-spin"
								icon={Loading02Icon}
							/>
							保存中...
						</>
					) : (
						'保存'
					)}
				</Button>
			</div>

			{/* Title input */}
			<Input
				autoFocus
				className="mb-4 border-none font-bold text-2xl shadow-none focus-visible:ring-0"
				onChange={(e) => setTitle(e.target.value)}
				placeholder="标题"
				value={title}
			/>

			{/* Editor */}
			<EntryEditor
				content={content}
				onChange={setContent}
				placeholder="开始写作..."
			/>
		</div>
	)
}