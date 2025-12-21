import { Link04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor, Range } from '@tiptap/core'
import type { SlashCommandItem } from './slash-command'

/**
 * Entry reference type definition
 */
type EntryRef = {
	id: string
	title: string
}

/**
 * Options for creating the ref command
 */
type CreateRefCommandOptions = {
	/** Function to get available entries for referencing */
	getEntries: () => EntryRef[]
	/** Function to open entry picker dialog */
	onOpenEntryPicker?: () => void
	/** Current entry ID to exclude from references */
	currentEntryId?: string
}

/**
 * Create a /ref slash command that inserts an internal link to another entry
 *
 * This command allows users to create connections between their notes
 * by inserting clickable references to other entries.
 */
export function createRefCommand(
	options: CreateRefCommandOptions
): SlashCommandItem {
	const { getEntries, onOpenEntryPicker, currentEntryId } = options

	return {
		title: '引用条目',
		description: '插入指向其他条目的链接',
		icon: <HugeiconsIcon className="size-4" icon={Link04Icon} />,
		keywords: ['ref', 'reference', 'link', 'entry', '引用', '链接', '条目'],
		group: 'FolioNote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			// Delete the slash command text
			editor.chain().focus().deleteRange(range).run()

			// If we have a picker callback, use it
			if (onOpenEntryPicker) {
				onOpenEntryPicker()
				return
			}

			// Get available entries, excluding current entry
			const allEntries = getEntries()
			const entries = currentEntryId
				? allEntries.filter((e) => e.id !== currentEntryId)
				: allEntries

			if (entries.length === 0) {
				// No entries available to reference
				return
			}

			// For simple implementation, insert a reference to the first entry
			// A more sophisticated implementation would show a popup to select
			const firstEntry = entries[0]
			if (firstEntry) {
				// Insert a clickable link to the entry
				const linkHtml = `<a href="/entries/${firstEntry.id}" class="entry-ref" data-entry-id="${firstEntry.id}">${firstEntry.title || '无标题'}</a>`
				editor.chain().focus().insertContent(linkHtml).run()
			}
		},
	}
}

// Store editor instance for later use when inserting entry ref
let currentEditor: Editor | null = null

/**
 * Get the current editor instance (set by the ref command)
 */
export function getCurrentEditor(): Editor | null {
	return currentEditor
}

/**
 * Create a ref command that dispatches a custom event
 * This allows the parent component to handle entry selection UI
 */
export function createRefCommandWithEvent(): SlashCommandItem {
	return {
		title: '引用条目',
		description: '插入指向其他条目的链接',
		icon: <HugeiconsIcon className="size-4" icon={Link04Icon} />,
		keywords: ['ref', 'reference', 'link', 'entry', '引用', '链接', '条目'],
		group: 'FolioNote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			// Delete the slash command text
			editor.chain().focus().deleteRange(range).run()

			// Store editor instance for later use
			currentEditor = editor

			// Dispatch a custom event that the parent can listen to
			const event = new CustomEvent('folio-note:open-entry-picker', {
				bubbles: true,
				detail: { editor },
			})
			document.dispatchEvent(event)
		},
	}
}

/**
 * Insert an entry reference link into the editor
 * Helper function to be called after user selects an entry
 */
export function insertEntryRef(editor: Editor, entry: EntryRef): void {
	const title = entry.title || '无标题'
	const linkHtml = `<a href="/entries/${entry.id}" class="entry-ref" data-entry-id="${entry.id}">${title}</a> `

	editor.chain().focus().insertContent(linkHtml).run()
}
