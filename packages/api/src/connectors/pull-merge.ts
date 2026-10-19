/**
 * Block-level three-way merge for Notion pull sync.
 *
 * Three versions of every imported top-level block, matched by its
 * `sourceBlockId`:
 *   base     — the block as last pulled (stored on entry_external_links)
 *   local    — the block in the entry now (the user may have edited it)
 *   incoming — the block in Notion now
 *
 * Rules:
 * - source changed, local untouched          → take the source
 * - local edited, source unchanged           → keep the user's edit
 * - both changed                             → keep local, report a conflict
 * - new in the source                        → insert at the source's position
 * - deleted in the source                    → drop it, unless edited locally
 *                                              (then it stays as the user's)
 * - deleted locally                          → stays deleted
 * - blocks without a sourceBlockId are the user's (notes, Mirra sentences):
 *   they stay attached right after the imported block they followed, and
 *   move to the nearest earlier surviving block if that one goes away.
 *
 * Pure: no I/O, so the rules above are unit-tested directly.
 */
import type { PMDoc, PMNode } from "../importers/types"
import { getImportSchema } from "../importers/validate"

export interface PullBase {
  blocks: Record<string, { rev: string; node: PMNode }>
}

export interface IncomingBlock {
  key: string
  rev: string
  node: PMNode
}

export interface PullConflict {
  key: string
  local: PMNode
  incoming: PMNode
  incomingRev: string
}

export interface PullResult {
  doc: PMDoc
  base: PullBase
  conflicts: PullConflict[]
  /** Keys whose node now comes from the source (their images need re-hosting). */
  taken: string[]
  stats: { updated: number; added: number; removed: number }
}

/** UI-only attributes that never count as an edit. */
const IGNORED_ATTRS = new Set(["collapsed"])

export function keyOf(node: PMNode): string | null {
  const key = node.attrs?.sourceBlockId
  return typeof key === "string" && key.length > 0 ? key : null
}

function withoutKey(node: PMNode): PMNode {
  return { ...node, attrs: { ...node.attrs, sourceBlockId: null } }
}

function stripIgnored(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripIgnored)
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !IGNORED_ATTRS.has(key))
        .map(([key, inner]) => [key, stripIgnored(inner)])
    )
  }
  return value
}

/**
 * Canonical form: editor output carries every default attribute, converter
 * output carries none — round-trip both through the schema before comparing.
 */
export function canonicalNode(node: PMNode): PMNode {
  return getImportSchema().nodeFromJSON(node).toJSON() as PMNode
}

export function sameBlock(a: PMNode, b: PMNode): boolean {
  return (
    JSON.stringify(stripIgnored(canonicalNode(a))) ===
    JSON.stringify(stripIgnored(canonicalNode(b)))
  )
}

interface LocalEntry {
  key: string
  node: PMNode
  /** The user's blocks that follow this imported block. */
  after: PMNode[]
}

/** Split the entry into user blocks before any import + imported blocks with their followers. */
function segmentLocal(local: PMDoc): {
  leading: PMNode[]
  entries: LocalEntry[]
} {
  const leading: PMNode[] = []
  const entries: LocalEntry[] = []
  const seen = new Set<string>()
  for (const node of local.content) {
    const key = keyOf(node)
    // A pasted duplicate of an imported block is the user's copy.
    if (key && !seen.has(key)) {
      seen.add(key)
      entries.push({ key, node, after: [] })
      continue
    }
    const userNode = key ? withoutKey(node) : node
    const current = entries.at(-1)
    if (current) {
      current.after.push(userNode)
    } else {
      leading.push(userNode)
    }
  }
  return { leading, entries }
}

export function mergePull(
  local: PMDoc,
  base: PullBase,
  incoming: IncomingBlock[]
): PullResult {
  const incomingKeys = new Set(incoming.map((block) => block.key))
  const { leading, entries } = segmentLocal(local)
  const stats = { updated: 0, added: 0, removed: 0 }

  // Imported blocks gone from the source: drop them (or keep the user's
  // edited version), and hand their followers to the nearest earlier
  // surviving block so nothing the user wrote is lost.
  const surviving = new Map<string, LocalEntry>()
  let carrier: PMNode[] = leading
  for (const entry of entries) {
    if (incomingKeys.has(entry.key)) {
      surviving.set(entry.key, entry)
      carrier = entry.after
      continue
    }
    const baseBlock = base.blocks[entry.key]
    const editedLocally = !baseBlock || !sameBlock(entry.node, baseBlock.node)
    if (editedLocally) {
      carrier.push(withoutKey(entry.node))
    } else {
      stats.removed++
    }
    carrier.push(...entry.after)
  }

  const content: PMNode[] = [...leading]
  const nextBase: PullBase = { blocks: {} }
  const conflicts: PullConflict[] = []
  const taken: string[] = []

  const take = (block: IncomingBlock) => {
    content.push(block.node)
    nextBase.blocks[block.key] = { rev: block.rev, node: block.node }
    taken.push(block.key)
  }

  for (const block of incoming) {
    const baseBlock = base.blocks[block.key]
    const localEntry = surviving.get(block.key)

    if (!baseBlock) {
      // New in the source (or never recorded): the source's version wins.
      take(block)
      stats.added++
      if (localEntry) content.push(...localEntry.after)
      continue
    }

    if (!localEntry) {
      // Deleted locally — the user's choice stands; remember the source
      // version so a later pull doesn't treat it as new.
      nextBase.blocks[block.key] = { rev: block.rev, node: block.node }
      continue
    }

    const sourceChanged = block.rev !== baseBlock.rev
    const editedLocally = !sameBlock(localEntry.node, baseBlock.node)

    if (!sourceChanged) {
      content.push(localEntry.node)
      nextBase.blocks[block.key] = baseBlock
    } else if (editedLocally) {
      content.push(localEntry.node)
      // Base stays at the old revision so the block remains in conflict
      // until the user picks a side.
      nextBase.blocks[block.key] = baseBlock
      conflicts.push({
        key: block.key,
        local: localEntry.node,
        incoming: block.node,
        incomingRev: block.rev
      })
    } else {
      take(block)
      stats.updated++
    }
    content.push(...localEntry.after)
  }

  return {
    doc: {
      type: "doc",
      content: content.length > 0 ? content : [{ type: "paragraph" }]
    },
    base: nextBase,
    conflicts,
    taken,
    stats
  }
}

/** Initial base after a fresh import: every keyed block as imported. */
export function baseFromImport(incoming: IncomingBlock[]): PullBase {
  return {
    blocks: Object.fromEntries(
      incoming.map((block) => [block.key, { rev: block.rev, node: block.node }])
    )
  }
}
