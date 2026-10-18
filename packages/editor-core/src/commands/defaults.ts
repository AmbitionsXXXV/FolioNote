import type { SlashCommandDefinition } from "../types"

/**
 * Default slash command definitions
 * These are platform-agnostic and use i18n keys for translations
 *
 * Note: We use type assertions for editor commands because the base Editor type
 * doesn't include extension-specific commands (like setHeading from StarterKit).
 * These commands are dynamically added by extensions at runtime.
 */
export const defaultSlashCommands: SlashCommandDefinition[] = [
  {
    id: "heading1",
    titleKey: "editor.slashCommand.heading1",
    descriptionKey: "editor.slashCommand.heading1Desc",
    iconId: "heading1",
    keywords: ["h1", "heading1", "title", "标题"],
    groupKey: "editor.slashCommand.headings",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .setHeading({ level: 1 })
        .run()
    }
  },
  {
    id: "heading2",
    titleKey: "editor.slashCommand.heading2",
    descriptionKey: "editor.slashCommand.heading2Desc",
    iconId: "heading2",
    keywords: ["h2", "heading2", "subtitle", "标题"],
    groupKey: "editor.slashCommand.headings",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .setHeading({ level: 2 })
        .run()
    }
  },
  {
    id: "heading3",
    titleKey: "editor.slashCommand.heading3",
    descriptionKey: "editor.slashCommand.heading3Desc",
    iconId: "heading3",
    keywords: ["h3", "heading3", "标题"],
    groupKey: "editor.slashCommand.headings",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .setHeading({ level: 3 })
        .run()
    }
  },
  {
    id: "quote",
    titleKey: "editor.slashCommand.quote",
    descriptionKey: "editor.slashCommand.quoteDesc",
    iconId: "quote",
    keywords: ["quote", "blockquote", "引用"],
    groupKey: "editor.slashCommand.basicBlocks",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any).setBlockquote().run()
    }
  },
  {
    id: "codeBlock",
    titleKey: "editor.slashCommand.codeBlock",
    descriptionKey: "editor.slashCommand.codeBlockDesc",
    iconId: "code",
    keywords: ["code", "codeblock", "代码"],
    groupKey: "editor.slashCommand.basicBlocks",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any).setCodeBlock().run()
    }
  },
  {
    id: "bulletList",
    titleKey: "editor.slashCommand.bulletList",
    descriptionKey: "editor.slashCommand.bulletListDesc",
    iconId: "bulletList",
    keywords: ["bullet", "list", "unordered", "列表"],
    groupKey: "editor.slashCommand.lists",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .toggleBulletList()
        .run()
    }
  },
  {
    id: "orderedList",
    titleKey: "editor.slashCommand.orderedList",
    descriptionKey: "editor.slashCommand.orderedListDesc",
    iconId: "orderedList",
    keywords: ["ordered", "list", "numbered", "列表"],
    groupKey: "editor.slashCommand.lists",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .toggleOrderedList()
        .run()
    }
  },
  {
    id: "taskList",
    titleKey: "editor.slashCommand.taskList",
    descriptionKey: "editor.slashCommand.taskListDesc",
    iconId: "taskList",
    keywords: ["todo", "task", "checklist", "checkbox", "待办", "清单"],
    groupKey: "editor.slashCommand.lists",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any).toggleTaskList().run()
    }
  },
  {
    id: "divider",
    titleKey: "editor.slashCommand.divider",
    descriptionKey: "editor.slashCommand.dividerDesc",
    iconId: "divider",
    keywords: ["divider", "hr", "horizontal", "分割"],
    groupKey: "editor.slashCommand.basicBlocks",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .setHorizontalRule()
        .run()
    }
  },
  {
    id: "table",
    titleKey: "editor.slashCommand.table",
    descriptionKey: "editor.slashCommand.tableDesc",
    iconId: "table",
    keywords: ["table", "grid", "spreadsheet", "表格"],
    groupKey: "editor.slashCommand.basicBlocks",
    submenuType: "tableGrid",
    execute: ({ editor, range }) => {
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    }
  },
  {
    id: "japaneseSentence",
    titleKey: "editor.slashCommand.japaneseSentence",
    descriptionKey: "editor.slashCommand.japaneseSentenceDesc",
    iconId: "japanese",
    keywords: [
      "japanese",
      "furigana",
      "mirra",
      "日语",
      "分词",
      "例句",
      "ふりがな"
    ],
    groupKey: "editor.slashCommand.basicBlocks",
    execute: ({ editor, range }) => {
      // Only editors that register JapaneseSentence expose the command.
      // biome-ignore lint/suspicious/noExplicitAny: extension commands are dynamically typed
      ;(editor.chain().focus().deleteRange(range) as any)
        .insertJapaneseSentence()
        .run()
    }
  }
]

/**
 * Get default slash commands
 */
export function getDefaultSlashCommands(): SlashCommandDefinition[] {
  return defaultSlashCommands
}
