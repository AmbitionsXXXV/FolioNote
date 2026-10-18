import { Fragment } from "@tiptap/pm/model"
import type { Node as PMNode, NodeType } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"

/**
 * Before checklists were a node type, the Markdown and Notion importers wrote
 * them as bullet items whose text starts with a checkbox glyph. Both glyphs
 * are a single UTF-16 unit, so the prefix is always two characters.
 */
const LEGACY_CHECKBOXES: Record<string, boolean> = { "☐ ": false, "☑ ": true }
const LEGACY_PREFIX_LENGTH = 2

interface ChecklistTypes {
  taskList: NodeType
  taskItem: NodeType
}

/** The item's checked state if it opens with a legacy checkbox, else null. */
function legacyChecked(item: PMNode): boolean | null {
  const paragraph = item.firstChild
  const text =
    paragraph?.type.name === "paragraph" ? paragraph.firstChild : null
  if (!text?.isText) {
    return null
  }
  return (
    LEGACY_CHECKBOXES[text.text?.slice(0, LEGACY_PREFIX_LENGTH) ?? ""] ?? null
  )
}

function toTaskItem(
  item: PMNode,
  checked: boolean,
  { taskItem }: ChecklistTypes
): PMNode {
  const [first, ...rest] = item.children
  const children = first
    ? [first.copy(first.content.cut(LEGACY_PREFIX_LENGTH)), ...rest]
    : rest
  return taskItem.create({ checked }, Fragment.fromArray(children))
}

/**
 * Converts nested lists first, then this node. A bullet list only becomes a
 * checklist when EVERY item carries a checkbox: a taskList can hold nothing
 * but taskItems, and the importers kept mixed lists as bullets on purpose.
 */
function convertNode(node: PMNode, types: ChecklistTypes): PMNode {
  if (node.isTextblock || node.isLeaf) {
    return node
  }
  const children = node.children.map((child) => convertNode(child, types))
  const changed = children.some((child, index) => child !== node.child(index))
  const current = changed ? node.copy(Fragment.fromArray(children)) : node
  if (current.type.name !== "bulletList" || current.childCount === 0) {
    return current
  }

  const items: PMNode[] = []
  for (const item of children) {
    const checked = legacyChecked(item)
    if (checked === null) {
      return current
    }
    items.push(toTaskItem(item, checked, types))
  }
  // Keeps the Notion pull-sync anchor (ignored by schemas without it)
  return types.taskList.create(
    { sourceBlockId: current.attrs.sourceBlockId },
    items
  )
}

/**
 * A transaction turning legacy "☐ / ☑" bullet lists into checklists, or null
 * when there are none (or the schema has no checklist nodes). Each changed
 * top-level block is replaced on its own, so a collaborative doc only sees
 * those blocks change.
 */
export function convertLegacyChecklists(
  state: EditorState
): Transaction | null {
  const { taskList, taskItem } = state.schema.nodes
  if (!(taskList && taskItem)) {
    return null
  }
  const types = { taskList, taskItem }
  const replacements: { pos: number; from: PMNode; to: PMNode }[] = []
  let pos = 0
  for (const block of state.doc.children) {
    const converted = convertNode(block, types)
    if (converted !== block) {
      replacements.push({ pos, from: block, to: converted })
    }
    pos += block.nodeSize
  }
  if (replacements.length === 0) {
    return null
  }
  const tr = state.tr
  // Back to front, so earlier positions stay valid
  for (const { pos, from, to } of replacements.toReversed()) {
    tr.replaceWith(pos, pos + from.nodeSize, to)
  }
  return tr
}
