import { ArrowLeft01Icon, Loading02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntryEditor } from '@/components/entry-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { orpc } from '@/utils/orpc'

export const Route = createFileRoute('/_app/entries/new')({
	// SPA 模式 - 新建条目页面无需 SSR
	ssr: false,
	component: NewEntryPage,
})

/**
 * Page for composing a new entry and saving it to the library.
 *
 * Presents a title input and rich editor, lets the user save a new entry (which invalidates the entries cache, shows success or error toasts, and navigates to the new entry's edit page), and provides a back button to return to the library.
 *
 * @returns The rendered JSX for the New Entry page component
 */
function NewEntryPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const [title, setTitle] = useState('')
	const [content, setContent] = useState('')
	const [contentJson, setContentJson] = useState('')

	// Create mutation
	const createMutation = useMutation({
		mutationFn: (data: {
			title?: string
			content?: string
			contentJson?: string
			isInbox?: boolean
		}) => orpc.entries.create.call(data),
		onSuccess: (entry) => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
			toast.success(t('entry.created'))
			// Navigate to the new entry's edit page
			if (entry) {
				navigate({ to: '/entries/$id', params: { id: entry.id } })
			}
		},
		onError: () => {
			toast.error(t('entry.createFailed'))
		},
	})

	const handleContentChange = useCallback((html: string, json: string) => {
		setContent(html)
		setContentJson(json)
	}, [])

	const handleSave = useCallback(() => {
		createMutation.mutate({
			title,
			content,
			contentJson,
			isInbox: false, // New entries from this page go to library
		})
	}, [createMutation, title, content, contentJson])

	const handleGoBack = useCallback(() => {
		navigate({ to: '/library' })
	}, [navigate])

	return (
		<div className="container mx-auto max-w-4xl px-4 py-6">
			{/* Header toolbar */}
			<div className="mb-6 flex items-center justify-between">
				<Button onClick={handleGoBack} size="sm" variant="ghost">
					<HugeiconsIcon className="mr-2 size-4" icon={ArrowLeft01Icon} />
					{t('common.back')}
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
							{t('editor.saving')}
						</>
					) : (
						t('common.save')
					)}
				</Button>
			</div>

			{/* Title input */}
			<Input
				autoFocus
				className="mb-4 border-none font-bold text-2xl shadow-none focus-visible:ring-0"
				onChange={(e) => setTitle(e.target.value)}
				placeholder={t('entry.title')}
				value={title}
			/>

			{/* Editor */}
			<EntryEditor
				content={contentJson}
				contentFormat="json"
				onChange={handleContentChange}
				placeholder={t('editor.placeholder')}
			/>
		</div>
	)
}
