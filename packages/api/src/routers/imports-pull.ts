/**
 * Notion pull sync: apply source changes to an entry with the block-level
 * merge in connectors/pull-merge.ts, and resolve the conflicts it reports.
 */
import { db, entries, entryExternalLinks } from "@folionote/db"
import { ORPCError } from "@orpc/server"
import { and, eq, isNull } from "drizzle-orm"

import {
  ImportSourceError,
  readNotionSource,
  rehostImagesInNodes
} from "../connectors/import-pipeline"
import type { ResolvedImport } from "../connectors/import-pipeline"
import {
  canonicalNode,
  keyOf,
  mergePull,
  sameBlock
} from "../connectors/pull-merge"
import type { PullBase, PullConflict } from "../connectors/pull-merge"
import type { PMDoc, PMNode } from "../importers/types"
import { assertValidDoc } from "../importers/validate"
import { processContentUpdate } from "../utils/content"
import { notifyEntryContentChanged } from "./entries"

type LinkRow = typeof entryExternalLinks.$inferSelect

export interface PullOutcome {
  link: LinkRow
  /** The entry's content was rewritten — open editors must reload it. */
  contentChanged: boolean
}

/** Base for a fresh pull-mode import: every keyed block as imported. */
export function pullBaseFromImport(
  doc: PMDoc,
  revisions: Record<string, string>
): PullBase {
  const base: PullBase = { blocks: {} }
  for (const node of doc.content) {
    const key = keyOf(node)
    if (key) {
      base.blocks[key] = {
        rev: revisions[key] ?? "",
        node: canonicalNode(node)
      }
    }
  }
  return base
}

/**
 * No stored base (the link predates pull mode): treat the entry's current
 * imported blocks as the base with an unknown revision, so every source
 * block counts as changed and replaces its untouched local copy, while the
 * user's own blocks are kept.
 */
function baseFromEntry(local: PMDoc): PullBase {
  return pullBaseFromImport(local, {})
}

function parseDoc(json: string | null): PMDoc {
  if (!json) return { type: "doc", content: [] }
  const parsed = JSON.parse(json) as PMDoc
  return { type: "doc", content: parsed.content ?? [] }
}

async function loadEntry(userId: string, entryId: string) {
  const [entry] = await db
    .select({ contentJson: entries.contentJson, version: entries.version })
    .from(entries)
    .where(
      and(
        eq(entries.id, entryId),
        eq(entries.userId, userId),
        isNull(entries.deletedAt)
      )
    )
  if (!entry) {
    throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
  }
  return entry
}

/**
 * Version-checked write: bumps the version so an editor holding the old
 * content gets CONFLICT on its next autosave instead of overwriting the pull.
 */
async function writeEntryContent(
  userId: string,
  entryId: string,
  version: string,
  doc: PMDoc
): Promise<void> {
  assertValidDoc(doc)
  const processed = processContentUpdate(JSON.stringify(doc))
  const updated = await db
    .update(entries)
    .set({
      contentJson: processed.contentJson,
      contentText: processed.contentText,
      version: String(Number(version) + 1)
    })
    .where(
      and(
        eq(entries.id, entryId),
        eq(entries.userId, userId),
        eq(entries.version, version)
      )
    )
    .returning({ id: entries.id })
  if (updated.length === 0) {
    throw new ORPCError("CONFLICT", {
      message: "The entry changed while syncing; try again"
    })
  }
  notifyEntryContentChanged(entryId, userId)
}

async function saveLink(
  linkId: string,
  values: Partial<typeof entryExternalLinks.$inferInsert>
): Promise<LinkRow> {
  const [row] = await db
    .update(entryExternalLinks)
    .set({ ...values, lastCheckedAt: new Date() })
    .where(eq(entryExternalLinks.id, linkId))
    .returning()
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Source link not found" })
  }
  return row
}

export async function performPull(
  userId: string,
  link: LinkRow,
  { force = false }: { force?: boolean } = {}
): Promise<PullOutcome> {
  let source: Awaited<ReturnType<typeof readNotionSource>>
  try {
    source = await readNotionSource(userId, link)
  } catch (error) {
    const message =
      error instanceof ImportSourceError || error instanceof Error
        ? error.message
        : "Sync failed"
    return {
      link: await saveLink(link.id, { status: "error", lastError: message }),
      contentChanged: false
    }
  }

  const revision = source.page.last_edited_time
  if (!force && revision === link.sourceRevision) {
    return {
      link: await saveLink(link.id, {
        status: link.conflicts?.length ? "conflict" : "up_to_date",
        lastError: null
      }),
      contentChanged: false
    }
  }

  const entry = await loadEntry(userId, link.entryId)
  const local = parseDoc(entry.contentJson)
  const base = (link.baseSnapshot as PullBase | null) ?? baseFromEntry(local)
  const result = mergePull(local, base, source.incoming)

  // Only blocks that now come from the source (or wait in a conflict) get
  // their expiring Notion images uploaded.
  const takenKeys = new Set(result.taken)
  const rewrite = await rehostImagesInNodes(
    userId,
    [
      ...result.doc.content.filter((node) => {
        const key = keyOf(node)
        return key !== null && takenKeys.has(key)
      }),
      ...result.conflicts.map((conflict) => conflict.incoming)
    ],
    source.assetUrls
  )
  const doc: PMDoc = { type: "doc", content: result.doc.content.map(rewrite) }
  for (const key of result.taken) {
    const block = result.base.blocks[key]
    if (block) result.base.blocks[key] = { ...block, node: rewrite(block.node) }
  }
  const conflicts: PullConflict[] = result.conflicts.map((conflict) => ({
    ...conflict,
    incoming: rewrite(conflict.incoming)
  }))

  const contentChanged =
    doc.content.length !== local.content.length ||
    doc.content.some((node, index) => {
      const before = local.content[index]
      return !before || !sameBlock(node, before)
    })
  if (contentChanged) {
    await writeEntryContent(userId, link.entryId, entry.version, doc)
  }

  return {
    link: await saveLink(link.id, {
      sourceRevision: revision,
      baseSnapshot: result.base,
      conflicts,
      status: conflicts.length > 0 ? "conflict" : "up_to_date",
      lastSyncedAt: new Date(),
      lastError: null
    }),
    contentChanged
  }
}

function replaceKeyedNode(doc: PMDoc, key: string, node: PMNode): PMDoc {
  let replaced = false
  const content = doc.content.map((current) => {
    if (!replaced && keyOf(current) === key) {
      replaced = true
      return node
    }
    return current
  })
  // The user deleted the block meanwhile: the source version comes back at the end.
  return { type: "doc", content: replaced ? content : [...content, node] }
}

export async function resolvePullConflict(
  userId: string,
  link: LinkRow,
  key: string,
  choice: "mine" | "source"
): Promise<PullOutcome> {
  const conflict = link.conflicts?.find((item) => item.key === key)
  if (!conflict) {
    throw new ORPCError("NOT_FOUND", { message: "Conflict already resolved" })
  }
  const base = (link.baseSnapshot as PullBase | null) ?? { blocks: {} }
  // Either way the source's version becomes the new base: "mine" keeps the
  // local block as a deliberate edit, so the next pull leaves it alone until
  // Notion changes that block again.
  base.blocks[key] = {
    rev: conflict.incomingRev,
    node: conflict.incoming as PMNode
  }

  let contentChanged = false
  if (choice === "source") {
    const entry = await loadEntry(userId, link.entryId)
    const doc = replaceKeyedNode(
      parseDoc(entry.contentJson),
      key,
      conflict.incoming as PMNode
    )
    await writeEntryContent(userId, link.entryId, entry.version, doc)
    contentChanged = true
  }

  const remaining = (link.conflicts ?? []).filter((item) => item.key !== key)
  return {
    link: await saveLink(link.id, {
      baseSnapshot: base,
      conflicts: remaining,
      status: remaining.length > 0 ? "conflict" : "up_to_date"
    }),
    contentChanged
  }
}

export function isPullable(resolved: ResolvedImport): boolean {
  return resolved.provider === "notion" && resolved.blockRevisions !== undefined
}
