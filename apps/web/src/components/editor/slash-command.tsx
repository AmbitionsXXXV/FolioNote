import {
	CodeIcon,
	DivideSignIcon,
	Heading01Icon,
	Heading02Icon,
	Heading03Icon,
	LeftToRightListBulletIcon,
	LeftToRightListNumberIcon,
	QuoteUpIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import Suggestion from '@tiptap/suggestion'
import {
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import tippy, { type Instance as TippyInstance } from 'tippy.js'

/**
 * Slash command item definition
 */
export type SlashCommandItem = {
	title: string
	description: string
	icon: ReactNode
	command: (props: { editor: Editor; range: Range }) => void
	keywords?: string[]
	group?: string
}

/**
 * Ref methods for the command list
 */
export type CommandListRef = {
	onKeyDown: (event: KeyboardEvent) => boolean
}

/**
 * Props passed to the command list component
 */
type CommandListProps = {
	items: SlashCommandItem[]
	command: (item: SlashCommandItem) => void
	ref?: Ref<CommandListRef>
}

/**
 * Slash command list component with keyboard navigation
 */
export function SlashCommandList({ items, command, ref }: CommandListProps) {
	const [selectedIndex, setSelectedIndex] = useState(0)
	const menuRef = useRef<HTMLDivElement>(null)

	const selectItem = useCallback(
		(index: number) => {
			const item = items[index]
			if (item) {
				command(item)
			}
		},
		[items, command]
	)

	const upHandler = useCallback(() => {
		setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
	}, [items.length])

	const downHandler = useCallback(() => {
		setSelectedIndex((prev) => (prev + 1) % items.length)
	}, [items.length])

	const enterHandler = useCallback(() => {
		selectItem(selectedIndex)
	}, [selectItem, selectedIndex])

	useEffect(() => {
		setSelectedIndex(0)
	}, [items])

	// Scroll selected item into view
	useEffect(() => {
		const menu = menuRef.current
		if (!menu) return

		const selectedItem = menu.querySelector('.slash-command-item.is-selected')
		if (selectedItem) {
			selectedItem.scrollIntoView({
				block: 'nearest',
				behavior: 'smooth',
			})
		}
	}, [selectedIndex])

	useImperativeHandle(ref, () => ({
		onKeyDown: (event: KeyboardEvent) => {
			if (event.key === 'ArrowUp') {
				upHandler()
				return true
			}

			if (event.key === 'ArrowDown') {
				downHandler()
				return true
			}

			if (event.key === 'Enter') {
				enterHandler()
				return true
			}

			return false
		},
	}))

	if (items.length === 0) {
		return (
			<div className="slash-command-menu">
				<div className="slash-command-empty">没有匹配的命令</div>
			</div>
		)
	}

	// Group items by their group property
	const groupedItems = items.reduce<Record<string, SlashCommandItem[]>>(
		(acc, item) => {
			const group = item.group ?? '基础'
			if (!acc[group]) {
				acc[group] = []
			}
			acc[group].push(item)
			return acc
		},
		{}
	)

	// Calculate flat index for each item
	const flatItems: { item: SlashCommandItem; group: string; index: number }[] = []
	let idx = 0
	for (const [group, groupItemsList] of Object.entries(groupedItems)) {
		for (const item of groupItemsList) {
			flatItems.push({ item, group, index: idx })
			idx += 1
		}
	}

	// Group flat items back for rendering
	const groupedFlat = flatItems.reduce<
		Record<string, { item: SlashCommandItem; index: number }[]>
	>((acc, { item, group, index }) => {
		if (!acc[group]) {
			acc[group] = []
		}
		acc[group].push({ item, index })
		return acc
	}, {})

	return (
		<div className="slash-command-menu" ref={menuRef}>
			{Object.entries(groupedFlat).map(([group, groupEntries]) => (
				<div className="slash-command-group" key={group}>
					<div className="slash-command-group-label">{group}</div>
					{groupEntries.map(({ item, index }) => (
						<button
							className={`slash-command-item ${
								index === selectedIndex ? 'is-selected' : ''
							}`}
							data-index={index}
							key={item.title}
							onClick={() => selectItem(index)}
							onMouseEnter={() => setSelectedIndex(index)}
							type="button"
						>
							<span className="slash-command-item-icon">{item.icon}</span>
							<div className="slash-command-item-content">
								<span className="slash-command-item-title">{item.title}</span>
								<span className="slash-command-item-description">
									{item.description}
								</span>
							</div>
						</button>
					))}
				</div>
			))}
		</div>
	)
}

/**
 * Get default slash command items
 */
export const getDefaultSlashCommands = (): SlashCommandItem[] => [
	{
		title: '标题 1',
		description: '大标题',
		icon: <HugeiconsIcon className="size-4" icon={Heading01Icon} />,
		keywords: ['h1', 'heading1', 'title', '标题'],
		group: '标题',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
		},
	},
	{
		title: '标题 2',
		description: '中标题',
		icon: <HugeiconsIcon className="size-4" icon={Heading02Icon} />,
		keywords: ['h2', 'heading2', 'subtitle', '标题'],
		group: '标题',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
		},
	},
	{
		title: '标题 3',
		description: '小标题',
		icon: <HugeiconsIcon className="size-4" icon={Heading03Icon} />,
		keywords: ['h3', 'heading3', '标题'],
		group: '标题',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
		},
	},
	{
		title: '引用',
		description: '引用块',
		icon: <HugeiconsIcon className="size-4" icon={QuoteUpIcon} />,
		keywords: ['quote', 'blockquote', '引用'],
		group: '基础块',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setBlockquote().run()
		},
	},
	{
		title: '代码块',
		description: '代码片段',
		icon: <HugeiconsIcon className="size-4" icon={CodeIcon} />,
		keywords: ['code', 'codeblock', '代码'],
		group: '基础块',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setCodeBlock().run()
		},
	},
	{
		title: '无序列表',
		description: '项目符号列表',
		icon: <HugeiconsIcon className="size-4" icon={LeftToRightListBulletIcon} />,
		keywords: ['bullet', 'list', 'unordered', '列表'],
		group: '列表',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run()
		},
	},
	{
		title: '有序列表',
		description: '编号列表',
		icon: <HugeiconsIcon className="size-4" icon={LeftToRightListNumberIcon} />,
		keywords: ['ordered', 'list', 'numbered', '列表'],
		group: '列表',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run()
		},
	},
	{
		title: '分割线',
		description: '水平分隔线',
		icon: <HugeiconsIcon className="size-4" icon={DivideSignIcon} />,
		keywords: ['divider', 'hr', 'horizontal', '分割'],
		group: '基础块',
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run()
		},
	},
]

/**
 * Filter commands by query
 */
export const filterCommands = (
	items: SlashCommandItem[],
	query: string
): SlashCommandItem[] => {
	const normalizedQuery = query.toLowerCase().trim()

	if (!normalizedQuery) {
		return items
	}

	return items.filter((item) => {
		const titleMatch = item.title.toLowerCase().includes(normalizedQuery)
		const descriptionMatch = item.description.toLowerCase().includes(normalizedQuery)
		const keywordMatch = item.keywords?.some((keyword) =>
			keyword.toLowerCase().includes(normalizedQuery)
		)

		return titleMatch || descriptionMatch || keywordMatch
	})
}

/**
 * Suggestion render function for React
 */
type SuggestionRenderProps = SuggestionProps<SlashCommandItem> & {
	items: SlashCommandItem[]
}

/**
 * Create the suggestion renderer
 */
const createSuggestionRenderer = () => {
	let reactRoot: Root | null = null
	let popup: TippyInstance[] | null = null
	let container: HTMLDivElement | null = null
	let componentRef: CommandListRef | null = null

	return {
		onStart: (props: SuggestionRenderProps) => {
			container = document.createElement('div')
			container.className = 'slash-command-container'
			document.body.appendChild(container)

			reactRoot = createRoot(container)
			reactRoot.render(
				<SlashCommandList
					command={(item) => props.command(item)}
					items={props.items}
					ref={(r) => {
						componentRef = r
					}}
				/>
			)

			popup = tippy('body', {
				getReferenceClientRect: props.clientRect as () => DOMRect,
				appendTo: () => document.body,
				content: container,
				showOnCreate: true,
				interactive: true,
				trigger: 'manual',
				placement: 'bottom-start',
				animation: 'shift-away',
				maxWidth: 320,
				offset: [0, 8],
			})
		},

		onUpdate: (props: SuggestionRenderProps) => {
			const firstPopup = popup?.[0]
			if (!reactRoot) return
			if (!firstPopup) return

			reactRoot.render(
				<SlashCommandList
					command={(item) => props.command(item)}
					items={props.items}
					ref={(r) => {
						componentRef = r
					}}
				/>
			)

			firstPopup.setProps({
				getReferenceClientRect: props.clientRect as () => DOMRect,
			})
		},

		onKeyDown: (props: { event: KeyboardEvent }) => {
			if (props.event.key === 'Escape') {
				popup?.[0]?.hide()
				return true
			}

			if (componentRef) {
				return componentRef.onKeyDown(props.event)
			}
			return false
		},

		onExit: () => {
			popup?.[0]?.destroy()
			reactRoot?.unmount()
			if (container?.parentNode) {
				container.parentNode.removeChild(container)
			}
			popup = null
			reactRoot = null
			container = null
			componentRef = null
		},
	}
}

/**
 * Slash command extension configuration options
 */
export type SlashCommandOptions = {
	suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'>
	commands?: SlashCommandItem[]
}

/**
 * Create the slash command extension
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
	name: 'slashCommand',

	addOptions() {
		return {
			suggestion: {
				char: '/',
				startOfLine: false,
				command: ({
					editor,
					range,
					props,
				}: {
					editor: Editor
					range: Range
					props: SlashCommandItem
				}) => {
					props.command({ editor, range })
				},
			},
			commands: getDefaultSlashCommands(),
		}
	},

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
				items: ({ query }: { query: string }) =>
					filterCommands(this.options.commands ?? [], query),
				render: createSuggestionRenderer,
			}),
		]
	},
})
