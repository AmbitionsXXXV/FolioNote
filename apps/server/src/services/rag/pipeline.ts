import type { NoteContext } from "@folionote/ai"
import { createLogger } from "@folionote/log"
import { embed } from "ai"
import type { EmbeddingModel, LanguageModel } from "ai"

import { searchNotesForRag } from "../notes"
import { multiRetrieve } from "./multi-retriever"
import { rewriteQuery } from "./query-rewriter"
import { rerankNotes } from "./reranker"

const log = createLogger({ prefix: "rag:pipeline" })

const DEFAULT_LIMIT_PER_ROUTE = 10

export interface RagPipelineConfig {
  enableQueryRewrite?: boolean
  enableRerank?: boolean
}

interface RagPipelineInput {
  userId: string
  query: string
  excludeIds: string[]
  topK: number
  model: LanguageModel
  embeddingModel?: EmbeddingModel
  config?: RagPipelineConfig
}

/**
 * Full RAG pipeline: query rewrite -> embed query -> multi-retrieve (with vector) -> rerank -> top-k.
 * Falls back to the legacy FTS-only path if any LLM step fails.
 */
export async function ragRetrieve(
  input: RagPipelineInput
): Promise<NoteContext[]> {
  const { userId, query, excludeIds, topK, model, embeddingModel, config } =
    input

  // An empty query turns the ILIKE routes into `%%`, which matches every note
  // and still pays for rewrite, embedding and rerank calls.
  if (!query.trim()) {
    return []
  }

  const enableRewrite = config?.enableQueryRewrite !== false
  const enableRerank = config?.enableRerank !== false

  try {
    // Step 1: Query rewriting
    let rewrittenQueries: string[] = []
    if (enableRewrite) {
      rewrittenQueries = await rewriteQuery(query, model)
    }

    // Step 1.5: Generate query embedding for vector search
    let queryEmbedding: number[] | undefined
    if (embeddingModel) {
      try {
        const result = await embed({ model: embeddingModel, value: query })
        queryEmbedding = result.embedding
      } catch (error) {
        log.warn(
          "Query embedding failed, falling back to keyword-only retrieval:",
          error
        )
      }
    }

    // Step 2: Multi-retrieval (with optional vector route)
    const candidates = await multiRetrieve(
      userId,
      query,
      rewrittenQueries,
      excludeIds,
      DEFAULT_LIMIT_PER_ROUTE,
      queryEmbedding
    )

    if (candidates.length === 0) {
      log.debug(
        "Multi-retrieve returned 0 candidates, falling back to legacy FTS"
      )
      return searchNotesForRag(userId, query, excludeIds, topK)
    }

    // Step 3: Rerank
    const notes: NoteContext[] = candidates.map(
      ({ sources: _sources, ...note }) => note
    )
    let ranked = notes
    if (enableRerank && notes.length > 1) {
      ranked = await rerankNotes(query, notes, { languageModel: model })
    }

    // Step 4: Top-K selection
    const topResults = ranked.slice(0, topK)

    log.debug(
      `RAG pipeline: ${rewrittenQueries.length} rewrites, ${candidates.length} candidates, vector=${queryEmbedding ? "yes" : "no"}, returning top-${topResults.length}`
    )

    return topResults
  } catch (error) {
    log.warn("RAG pipeline failed, falling back to legacy FTS:", error)
    return searchNotesForRag(userId, query, excludeIds, topK)
  }
}
