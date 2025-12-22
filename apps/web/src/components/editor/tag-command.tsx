import { Tag01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor, Range } from '@tiptap/core'
import type { SlashCommandItem } from './slash-command'

/**
 * Tag type definition
 */
type Tag = {
	id: string
	name: string
	color: string | null
}

/**
 * Options for creating the tag command
 */
type CreateTagCommandOptions = {
	/** Function to get all available tags */
	getTags: () => Tag[]
	/** Function to add a tag to the current entry */
	onAddTag: (tagId: string) => void
	/** Function to create a new tag and add it */
	onCreateTag?: (name: string) => void
}

/**
 * Create a /tag slash command that opens a tag picker dialog
 *
 * Note: This is a simplified implementation that inserts a tag mention.
 * For a full implementation with async search, consider using a separate
 * mention extension or a custom popup.
 */
export function createTagCommand(
	options: CreateTagCommandOptions,
	t: (key: string) => string
): SlashCommandItem {
	const { onAddTag, getTags } = options

	return {
		title: t('editor.tagCommand.addTag'),
		description: t('editor.tagCommand.addTagDesc'),
		icon: <HugeiconsIcon className="size-4" icon={Tag01Icon} />,
		keywords: ['tag', 'label', '标签'],
		group: 'FolioNote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			// Delete the slash command text
			editor.chain().focus().deleteRange(range).run()

			// Get available tags
			const tags = getTags()

			if (tags.length === 0) {
				// No tags available, could show a toast or create dialog
				return
			}

			// For now, add the first tag as a simple implementation
			// A more sophisticated implementation would show a popup to select
			const firstTag = tags[0]
			if (firstTag) {
				onAddTag(firstTag.id)
			}
		},
	}
}

/**
 * Create a tag command that dispatches a custom event
 * This allows the parent component to handle tag selection UI
 */
export function createTagCommandWithEvent(
	t: (key: string) => string
): SlashCommandItem {
	return {
		title: t('editor.tagCommand.addTag'),
		description: t('editor.tagCommand.addTagDesc'),
		icon: <HugeiconsIcon className="size-4" icon={Tag01Icon} />,
		keywords: ['tag', 'label', '标签'],
		group: 'FolioNote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			// Delete the slash command text
			editor.chain().focus().deleteRange(range).run()

			// Dispatch a custom event that the parent can listen to
			const event = new CustomEvent('folio-note:open-tag-picker', {
				bubbles: true,
				detail: { editor },
			})
			document.dispatchEvent(event)
		},
	}
}
