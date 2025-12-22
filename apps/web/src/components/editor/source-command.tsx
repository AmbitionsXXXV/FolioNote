import { Book02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor, Range } from '@tiptap/core'
import type { SlashCommandItem } from './slash-command'

/**
 * Source type definition
 */
type Source = {
	id: string
	title: string
	type: string
	url: string | null
	author: string | null
}

/**
 * Options for creating the source command
 */
type CreateSourceCommandOptions = {
	/** Function to get all available sources */
	getSources: () => Source[]
	/** Function to add a source to the current entry */
	onAddSource: (sourceId: string) => void
	/** Function to open source picker dialog */
	onOpenSourcePicker?: () => void
}

/**
 * Create a /source slash command that allows linking sources to an entry
 *
 * This command provides quick access to associate learning sources
 * (books, articles, videos, etc.) with the current entry.
 */
export function createSourceCommand(
	options: CreateSourceCommandOptions,
	t: (key: string) => string
): SlashCommandItem {
	const { onAddSource, getSources, onOpenSourcePicker } = options

	return {
		title: t('editor.sourceCommand.linkSource'),
		description: t('editor.sourceCommand.linkSourceDesc'),
		icon: <HugeiconsIcon className="size-4" icon={Book02Icon} />,
		keywords: ['source', 'link', 'book', 'article', '来源', '书籍', '文章'],
		group: 'FolioNote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			// Delete the slash command text
			editor.chain().focus().deleteRange(range).run()

			// If we have a picker callback, use it
			if (onOpenSourcePicker) {
				onOpenSourcePicker()
				return
			}

			// Get available sources
			const sources = getSources()

			if (sources.length === 0) {
				// No sources available
				return
			}

			// For simple implementation, add the first source
			// A more sophisticated implementation would show a popup to select
			const firstSource = sources[0]
			if (firstSource) {
				onAddSource(firstSource.id)
			}
		},
	}
}

/**
 * Create a source command that dispatches a custom event
 * This allows the parent component to handle source selection UI
 */
export function createSourceCommandWithEvent(
	t: (key: string) => string
): SlashCommandItem {
	return {
		title: t('editor.sourceCommand.linkSource'),
		description: t('editor.sourceCommand.linkSourceDesc'),
		icon: <HugeiconsIcon className="size-4" icon={Book02Icon} />,
		keywords: ['source', 'link', 'book', 'article', '来源', '书籍', '文章'],
		group: 'FolioNote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			// Delete the slash command text
			editor.chain().focus().deleteRange(range).run()

			// Dispatch a custom event that the parent can listen to
			const event = new CustomEvent('folio-note:open-source-picker', {
				bubbles: true,
				detail: { editor },
			})
			document.dispatchEvent(event)
		},
	}
}
