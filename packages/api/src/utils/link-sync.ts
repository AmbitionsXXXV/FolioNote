/**
 * Entry link synchronization
 *
 * Extracts entry references from ProseMirror JSON content
 * and synchronizes them with the entry_links table.
 */

import { db, entryLinks } from "@folionote/db"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"

interface ProseMirrorNode {
  type: string
  content?: ProseMirrorNode[]
  text?: string
  marks?: Array<{
    type: string
    attrs?: Record<string, unknown>
  }>
  attrs?: Record<string, unknown>
}

const ENTRY_HREF_PATTERN = /^\/entries\/([a-zA-Z0-9_-]+)/

/**
 * Extract target entry IDs from ProseMirror JSON content.
 *
 * Looks for `<a class="entry-ref" data-entry-id="...">` links
 * produced by the /ref slash command.
 */
export function extractEntryRefs(
  contentJson: string | null | undefined
): string[] {
  if (!contentJson) {
    return []
  }

  let doc: ProseMirrorNode
  try {
    doc = JSON.parse(contentJson) as ProseMirrorNode
  } catch {
    return []
  }

  const ids = new Set<string>()
  collectEntryRefs(doc, ids)
  return [...ids]
}

function extractIdFromMark(
  mark: NonNullable<ProseMirrorNode["marks"]>[number]
): string | null {
  if (mark.type !== "link" || !mark.attrs) {
    return null
  }

  const entryId = mark.attrs["data-entry-id"]
  if (typeof entryId === "string" && entryId.length > 0) {
    return entryId
  }

  const { href } = mark.attrs
  if (typeof href === "string") {
    const match = ENTRY_HREF_PATTERN.exec(href)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

function collectEntryRefs(node: ProseMirrorNode, ids: Set<string>): void {
  if (node.marks) {
    for (const mark of node.marks) {
      const id = extractIdFromMark(mark)
      if (id) {
        ids.add(id)
      }
    }
  }

  if (node.content) {
    for (const child of node.content) {
      collectEntryRefs(child, ids)
    }
  }
}

/**
 * Synchronize entry_links of type 'ref' for a given entry.
 *
 * Diffs the current set of referenced entry IDs against the DB
 * and inserts/deletes as needed. Only touches 'ref' links;
 * 'manual' links are left untouched.
 */
export async function syncEntryLinks(
  userId: string,
  sourceEntryId: string,
  currentRefIds: string[]
): Promise<void> {
  const uniqueRefIds = [...new Set(currentRefIds)].filter(
    (id) => id !== sourceEntryId
  )

  const existingLinks = await db
    .select({
      id: entryLinks.id,
      targetEntryId: entryLinks.targetEntryId
    })
    .from(entryLinks)
    .where(
      and(
        eq(entryLinks.sourceEntryId, sourceEntryId),
        eq(entryLinks.linkType, "ref")
      )
    )

  const existingTargetIds = new Set(existingLinks.map((l) => l.targetEntryId))
  const desiredTargetIds = new Set(uniqueRefIds)

  const toInsert = uniqueRefIds.filter((id) => !existingTargetIds.has(id))
  const toDelete = existingLinks
    .filter((l) => !desiredTargetIds.has(l.targetEntryId))
    .map((l) => l.id)

  if (toDelete.length > 0) {
    await db.delete(entryLinks).where(inArray(entryLinks.id, toDelete))
  }

  if (toInsert.length > 0) {
    await db
      .insert(entryLinks)
      .values(
        toInsert.map((targetEntryId) => ({
          id: nanoid(),
          userId,
          sourceEntryId,
          targetEntryId,
          linkType: "ref" as const
        }))
      )
      // Overlapping autosaves can both compute the same insert set; the unique
      // (source, target, type) index would otherwise fail the second save.
      .onConflictDoNothing()
  }
}
