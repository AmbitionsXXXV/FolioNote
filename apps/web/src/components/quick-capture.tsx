import { Add01Icon, Loading02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type KeyboardEvent, useState } from 'react'
import { orpc } from '@/utils/orpc'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

type QuickCaptureProps = {
	placeholder?: string
	onSuccess?: () => void
}

// Regex to check if line ends with punctuation (used for title detection)
const TITLE_PUNCTUATION_REGEX = /[.。!！?？]$/

/**
 * Compact textarea for quickly creating an inbox entry from typed text.
 *
 * Splits multi-line input into a short title (first line) and content when the first line is under 100 characters and does not end with punctuation; otherwise treats the whole input as content. Use Ctrl/Cmd+Enter to submit. On successful creation the input is cleared and the 'entries' cache is invalidated.
 *
 * @param placeholder - Placeholder text shown inside the textarea
 * @param onSuccess - Optional callback invoked after a successful entry creation
 * @returns A React element that renders the quick-capture textarea and submit button
 */
export function QuickCapture({
	placeholder = '快速记录想法...',
	onSuccess,
}: QuickCaptureProps) {
	const [value, setValue] = useState('')
	const queryClient = useQueryClient()

	const createMutation = useMutation({
		mutationFn: (data: { title?: string; content?: string; isInbox?: boolean }) =>
			orpc.entries.create.call(data),
		onSuccess: () => {
			setValue('')
			queryClient.invalidateQueries({ queryKey: ['entries'] })
			onSuccess?.()
		},
	})

	const handleSubmit = () => {
		const trimmedValue = value.trim()
		if (!trimmedValue) return

		// Check if the first line looks like a title (short and no punctuation at end)
		const lines = trimmedValue.split('\n')
		const firstLine = lines[0]
		const isTitle =
			firstLine && firstLine.length < 100 && !TITLE_PUNCTUATION_REGEX.test(firstLine)

		if (isTitle && lines.length > 1) {
			// First line is title, rest is content
			createMutation.mutate({
				title: firstLine,
				content: `<p>${lines.slice(1).join('</p><p>')}</p>`,
				isInbox: true,
			})
		} else {
			// Everything is content
			createMutation.mutate({
				title: '',
				content: `<p>${trimmedValue}</p>`,
				isInbox: true,
			})
		}
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault()
			handleSubmit()
		}
	}

	return (
		<div className="flex gap-2">
			<div className="relative flex-1">
				<Textarea
					className="pr-10"
					disabled={createMutation.isPending}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					value={value}
				/>
				{createMutation.isPending ? (
					<div className="absolute top-3 right-3">
						<HugeiconsIcon
							className="size-4 animate-spin text-muted-foreground"
							icon={Loading02Icon}
						/>
					</div>
				) : null}
			</div>
			<Button
				disabled={!value.trim() || createMutation.isPending}
				onClick={handleSubmit}
				size="icon"
			>
				<HugeiconsIcon className="size-4" icon={Add01Icon} />
			</Button>
		</div>
	)
}
