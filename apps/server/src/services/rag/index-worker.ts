import { createHash } from "node:crypto"

import {
  PROVIDER_CONFIGS,
  providerSupports,
  splitEntryContent
} from "@folionote/ai"
import type { DecryptedCredential } from "@folionote/ai"
import { createVercelAiEmbeddingModel } from "@folionote/ai/vercel-ai"
import { db, entries, entryChunks } from "@folionote/db"
import { createLogger } from "@folionote/log"
import { embedMany } from "ai"
import { and, eq, sql } from "drizzle-orm"
import { nanoid } from "nanoid"

const log = createLogger({ prefix: "rag:index-worker" })

// entries.updatedAt has $onUpdate(() => new Date()); indexing status writes are
// bookkeeping and must not change a note's "last edited" time or list order.
const KEEP_UPDATED_AT = { updatedAt: sql`${entries.updatedAt}` }

/**
 * Resolve an embedding-capable credential from environment variables.
 *
 * Follows the same fallback pattern as image-captioning:
 * OPENAI_API_KEY > GEMINI_API_KEY > QWEN_API_KEY
 */
function resolveEnvEmbeddingCredential(): DecryptedCredential | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: PROVIDER_CONFIGS.openai.defaultBaseUrl
    }
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: PROVIDER_CONFIGS.gemini.defaultBaseUrl
    }
  }
  if (process.env.QWEN_API_KEY) {
    return {
      provider: "qwen",
      apiKey: process.env.QWEN_API_KEY,
      baseUrl: PROVIDER_CONFIGS.qwen.defaultBaseUrl
    }
  }
  return null
}

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

/**
 * Index a single entry: split → embed → store in entry_chunks.
 *
 * Skips indexing when:
 * - Entry not found or has no content
 * - Content hash unchanged (already indexed)
 * - No embedding credential available
 */
export async function indexEntry(
  entryId: string,
  userId: string
): Promise<void> {
  const [entry] = await db
    .select({
      id: entries.id,
      title: entries.title,
      contentText: entries.contentText,
      contentHash: entries.contentHash,
      embeddingStatus: entries.embeddingStatus
    })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1)

  if (!entry?.contentText?.trim()) {
    await db.delete(entryChunks).where(eq(entryChunks.entryId, entryId))
    if (entry) {
      await db
        .update(entries)
        .set({ embeddingStatus: null, contentHash: null, ...KEEP_UPDATED_AT })
        .where(eq(entries.id, entryId))
    }
    log.debug(
      `Skip indexing entry ${entryId}: no content, cleared stale chunks`
    )
    return
  }

  const newHash = computeContentHash(entry.contentText)
  if (entry.contentHash === newHash && entry.embeddingStatus === "indexed") {
    log.debug(`Skip indexing entry ${entryId}: content unchanged`)
    return
  }

  const credential = resolveEnvEmbeddingCredential()
  if (!credential) {
    await db
      .update(entries)
      .set({ embeddingStatus: "no_provider", ...KEEP_UPDATED_AT })
      .where(eq(entries.id, entryId))
    log.debug(`Skip indexing entry ${entryId}: no embedding credential`)
    return
  }

  if (!providerSupports(credential.provider, "embedding")) {
    await db
      .update(entries)
      .set({ embeddingStatus: "no_provider", ...KEEP_UPDATED_AT })
      .where(eq(entries.id, entryId))
    log.debug(
      `Skip indexing entry ${entryId}: provider ${credential.provider} has no embedding`
    )
    return
  }

  await db
    .update(entries)
    .set({ embeddingStatus: "pending", ...KEEP_UPDATED_AT })
    .where(eq(entries.id, entryId))

  try {
    const chunks = await splitEntryContent(entry.title, entry.contentText)
    if (chunks.length === 0) {
      await db.delete(entryChunks).where(eq(entryChunks.entryId, entryId))
      await db
        .update(entries)
        .set({ embeddingStatus: null, contentHash: null, ...KEEP_UPDATED_AT })
        .where(eq(entries.id, entryId))
      log.debug(
        `Skip indexing entry ${entryId}: no chunks produced, cleared stale chunks`
      )
      return
    }

    const embeddingModel = createVercelAiEmbeddingModel(credential)
    const result = await embedMany({
      model: embeddingModel,
      values: chunks.map((c) => c.content)
    })

    const { modelId } = embeddingModel
    const now = new Date()

    const chunkRows = chunks.map((chunk, idx) => ({
      id: nanoid(),
      entryId,
      userId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: result.embeddings.at(idx) ?? [],
      embeddingModel: modelId,
      contentHash: newHash,
      metadata: JSON.stringify(chunk.metadata),
      createdAt: now,
      updatedAt: now
    }))

    await db.transaction(async (tx) => {
      await tx.delete(entryChunks).where(eq(entryChunks.entryId, entryId))
      if (chunkRows.length > 0) {
        await tx.insert(entryChunks).values(chunkRows)
      }
      await tx
        .update(entries)
        .set({
          embeddingStatus: "indexed",
          contentHash: newHash,
          ...KEEP_UPDATED_AT
        })
        .where(eq(entries.id, entryId))
    })

    log.info(
      `Indexed entry ${entryId}: ${chunkRows.length} chunks, model=${modelId}`
    )
  } catch (error) {
    await db
      .update(entries)
      .set({ embeddingStatus: "failed", ...KEEP_UPDATED_AT })
      .where(eq(entries.id, entryId))
    throw error
  }
}
