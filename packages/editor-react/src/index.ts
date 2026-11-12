// Re-export from editor-core
export {
  type CommandContext,
  type ContentFormat,
  CustomLink,
  createLinkExtension,
  defaultLinkOptions,
  // Commands
  defaultSlashCommands,
  filterCommands,
  getDefaultSlashCommands,
  getResolvedDefaultCommands,
  // Types
  type IconId,
  type LinkOptions,
  // Extensions
  PasteHandler,
  type PasteHandlerOptions,
  type PasteStrategy,
  resolveCommands,
  type SlashCommandDefinition,
  type SlashCommandItem,
  type SuggestionAdapter,
  type SuggestionState,
  type TranslateFunction
} from "@folionote/editor-core"

// Components
export {
  CodeBlockShikiView,
  type CodeBlockViewProps,
  type CommandListRef,
  defaultIconMap,
  type IconMapType,
  LANGUAGE_OPTIONS,
  SlashCommandList
} from "./components"

// Extensions
export {
  CodeBlockShiki,
  CustomCaret,
  type CustomCaretOptions,
  CustomTable,
  CustomTableCell,
  CustomTableHeader,
  type CustomTableOptions,
  CustomTableRow,
  createSlashCommandExtension,
  createTableKit,
  FoldableHeadings,
  type SlashCommandExtensionOptions,
  TableCommands,
  TableKit
} from "./extensions"

// Hooks
export { useEditorCommands } from "./hooks"
