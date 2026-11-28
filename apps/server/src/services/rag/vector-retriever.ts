import type { NoteContext } from "@folionote/ai"
import { db, entries, entryChunks } from "@folionote/db"
import { createLogger } from "@folionote/log"
import {
  and,
  cosineDistance,
  eq,
  isNotNull,
  isNull,
  notInArray,
  sql
} from "drizzle-orm"

const log = createLogger({ prefix: "rag:vector-retriever" })

const DEFAULT_MIN_SIMILARITY = 0.3

/**
 * How many nearest chunks to pull from the index per requested entry.
 * Several chunks of one entry usually rank together, and entries that are
 * deleted / still in the inbox / excluded are dropped after the scan, so
 * over-fetch to keep `limit` distinct entries after filtering.
 */
const CANDIDATE_CHUNKS_PER_RESULT = 8

/**
 * Search entries by vector cosine similarity against the entry_chunks table.
 *
 * Returns distinct entries ranked by the best-matching chunk similarity.
 *
 * Query shape matters for the HNSW index (entry_chunks_embedding_cosine_idx):
 * pgvector only uses it for `ORDER BY embedding <=> $q LIMIT n`. The previous
 * DISTINCT ON (entry_id) ... ORDER BY entry_id query forced a full distance
 * computation over every chunk of the user, and its LIMIT then kept the first
 * entries by id rather than the most similar ones. So: nearest chunks first
 * in a CTE, join + filter entries afterwards, dedupe by entry in JS.
 */
export async function searchByVectorSimilarity(
  userId: string,
  queryEmbedding: number[],
  excludeIds: string[],
  limit: number,
  minSimilarity = DEFAULT_MIN_SIMILARITY
): Promise<NoteContext[]> {
  try {
    const distance = cosineDistance(entryChunks.embedding, queryEmbedding)

    const nearestChunks = db.$with("nearest_chunks").as(
      db
        .select({
          entryId: entryChunks.entryId,
          distance: sql<number>`${distance}`.as("distance")
        })
        .from(entryChunks)
        .where(
          and(eq(entryChunks.userId, userId), isNotNull(entryChunks.embedding))
        )
        .orderBy(distance)
        .limit(limit * CANDIDATE_CHUNKS_PER_RESULT)
    )

    const entryConditions = [
      isNull(entries.deletedAt),
      eq(entries.isInbox, false)
    ]
    if (excludeIds.length > 0) {
      entryConditions.push(notInArray(entries.id, excludeIds))
    }

    const rows = await db
      .with(nearestChunks)
      .select({
        id: entries.id,
        title: entries.title,
        contentText: entries.contentText,
        distance: nearestChunks.distance
      })
      .from(nearestChunks)
      .innerJoin(entries, eq(nearestChunks.entryId, entries.id))
      .where(and(...entryConditions))
      .orderBy(nearestChunks.distance)

    // Rows arrive nearest-first, so the first occurrence of an entry is its
    // best chunk. `distance` comes back from pg as a numeric string.
    const seen = new Set<string>()
    const results: Array<NoteContext & { similarity: number }> = []
    for (const row of rows) {
      if (results.length >= limit) {
        break
      }
      if (seen.has(row.id)) {
        continue
      }
      const similarity = 1 - Number(row.distance)
      if (similarity <= minSimilarity) {
        // Sorted ascending by distance: everything after is less similar.
        break
      }
      seen.add(row.id)
      results.push({
        id: row.id,
        title: row.title,
        contentText: row.contentText ?? "",
        similarity
      })
    }

    log.debug(
      `Vector search: ${results.length} results (top similarity: ${results[0]?.similarity.toFixed(3) ?? "N/A"})`
    )

    return results.map(({ id, title, contentText }) => ({
      id,
      title,
      contentText
    }))
  } catch (error) {
    log.warn("Vector similarity search failed:", error)
    return []
  }
}
