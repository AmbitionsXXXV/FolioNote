import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/**
 * Custom Caret Extension for TipTap
 *
 * Creates a custom animated caret with comet tail effect
 * Hides the native caret and renders a custom one that follows cursor position
 */

const CARET_CLASS = 'tiptap-caret'
const CARET_MOVING_CLASS = 'tiptap-caret-moving'

type CaretPosition = {
	left: number
	top: number
	height: number
}

function getCaretPosition(view: EditorView): CaretPosition | null {
	const { state } = view
	const { selection } = state

	// Only show caret when selection is collapsed (cursor, not selection)
	if (!selection.empty) {
		return null
	}

	try {
		const coords = view.coordsAtPos(selection.from)
		const editorRect = view.dom.getBoundingClientRect()

		return {
			left: coords.left - editorRect.left,
			top: coords.top - editorRect.top,
			height: coords.bottom - coords.top,
		}
	} catch {
		return null
	}
}

function createCaretElement(): HTMLElement {
	const caret = document.createElement('div')
	caret.className = CARET_CLASS
	caret.setAttribute('aria-hidden', 'true')
	return caret
}

function updateCaretPosition(
	caret: HTMLElement,
	position: CaretPosition,
	previousPosition: CaretPosition | null
): void {
	const isMoving =
		previousPosition &&
		(Math.abs(position.left - previousPosition.left) > 1 ||
			Math.abs(position.top - previousPosition.top) > 1)

	if (isMoving) {
		caret.classList.add(CARET_MOVING_CLASS)
		// Remove moving class after transition completes
		setTimeout(() => {
			caret.classList.remove(CARET_MOVING_CLASS)
		}, 100)
	}

	caret.style.left = `${position.left}px`
	caret.style.top = `${position.top}px`
	caret.style.height = `${position.height}px`
	caret.style.display = 'block'
}

function hideCaret(caret: HTMLElement): void {
	caret.style.display = 'none'
}

export type CustomCaretOptions = {
	/** Whether to enable the custom caret */
	enabled: boolean
}

export const CustomCaret = Extension.create<CustomCaretOptions>({
	name: 'customCaret',

	addOptions() {
		return {
			enabled: true,
		}
	},

	addProseMirrorPlugins() {
		if (!this.options.enabled) {
			return []
		}

		let caretElement: HTMLElement | null = null
		let previousPosition: CaretPosition | null = null
		let rafId: number | null = null

		const pluginKey = new PluginKey('customCaret')

		return [
			new Plugin({
				key: pluginKey,

				view(editorView) {
					// Create and append caret element
					caretElement = createCaretElement()
					editorView.dom.parentElement?.appendChild(caretElement)

					// Initial position update
					const updateCaret = () => {
						if (!caretElement) return

						const position = getCaretPosition(editorView)
						if (position) {
							updateCaretPosition(caretElement, position, previousPosition)
							previousPosition = position
						} else {
							hideCaret(caretElement)
							previousPosition = null
						}
					}

					// Use requestAnimationFrame for smooth updates
					const scheduleUpdate = () => {
						if (rafId) {
							cancelAnimationFrame(rafId)
						}
						rafId = requestAnimationFrame(updateCaret)
					}

					// Initial update
					scheduleUpdate()

					return {
						update() {
							scheduleUpdate()
						},

						destroy() {
							if (rafId) {
								cancelAnimationFrame(rafId)
							}
							if (caretElement?.parentElement) {
								caretElement.parentElement.removeChild(caretElement)
							}
							caretElement = null
							previousPosition = null
						},
					}
				},

				props: {
					handleDOMEvents: {
						focus: (view) => {
							// Show caret on focus
							if (caretElement) {
								const position = getCaretPosition(view)
								if (position) {
									updateCaretPosition(caretElement, position, previousPosition)
									previousPosition = position
								}
							}
							return false
						},

						blur: () => {
							// Hide caret on blur
							if (caretElement) {
								hideCaret(caretElement)
								previousPosition = null
							}
							return false
						},
					},
				},
			}),
		]
	},
})
