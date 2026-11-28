import {
  db,
  entries,
  entryColumns,
  entrySources,
  entryTags,
  searchHistory
} from "@folionote/db"
import type { EntryRow } from "@folionote/db"
import { createLogger } from "@folionote/log"
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql
} from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { protectedProcedure } from "../index"

const log = createLogger({ prefix: "search" })

// Regex for splitting query into search terms (defined at top level for performance)
const WHITESPACE_REGEX = /\s+/

/**
 * Input schema for basic search (backward compatible)
 */
const SearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20)
})

/**
 * Input schema for advanced search with filters
 */
const AdvancedSearchInputSchema = z.object({
  query: z.string().max(500).optional(),
  tagIds: z.array(z.string()).optional(),
  sourceIds: z.array(z.string()).optional(),
  dateRange: z
    .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional()
    })
    .optional(),
  isInbox: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  /** Whether to use full-text search (FTS) instead of ILIKE */
  useFts: z.boolean().optional().default(true),
  /** Whether to save this search to history */
  saveToHistory: z.boolean().optional().default(false)
})

/**
 * Input schema for search history operations
 */
const SaveHistoryInputSchema = z.object({
  query: z.string().max(500),
  filters: z
    .object({
      tagIds: z.array(z.string()).optional(),
      sourceIds: z.array(z.string()).optional(),
      dateRange: z
        .object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional()
        })
        .optional(),
      isInbox: z.boolean().optional(),
      isStarred: z.boolean().optional()
    })
    .optional(),
  resultCount: z.number().int().optional()
})

const GetHistoryInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10)
})

const DeleteHistoryInputSchema = z.object({
  id: z.string().optional(),
  deleteAll: z.boolean().optional()
})

const GetSuggestionsInputSchema = z.object({
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(10).default(5)
})

/**
 * Perform full-text search using PostgreSQL to_tsquery
 * Falls back to ILIKE if FTS returns no results
 *
 * Note: We order by updatedAt DESC only (not ts_rank) to ensure consistent
 * cursor-based pagination. Relevance ranking would require a more complex
 * composite cursor implementation.
 */
async function performFtsSearch(
  userId: string,
  query: string,
  additionalConditions: ReturnType<typeof eq>[],
  limit: number,
  cursor?: string
) {
  // Prepare the search query for FTS
  // Split query into words and join with & for AND search
  const searchTerms = query
    .trim()
    .split(WHITESPACE_REGEX)
    .filter((term) => term.length > 0)
    .map((term) => `${term}:*`) // Add prefix matching
    .join(" & ")

  if (!searchTerms) {
    return { items: [], usedFts: false }
  }

  const conditions = [
    eq(entries.userId, userId),
    isNull(entries.deletedAt),
    ...additionalConditions
  ]

  // Add cursor condition for pagination
  if (cursor) {
    const [cursorEntry] = await db
      .select({ updatedAt: entries.updatedAt })
      .from(entries)
      .where(eq(entries.id, cursor))
      .limit(1)

    if (cursorEntry) {
      conditions.push(lt(entries.updatedAt, cursorEntry.updatedAt))
    }
  }

  // Try FTS first. Must match against the stored `search_vector` column so
  // Postgres can use entries_search_vector_idx (GIN); computing to_tsvector()
  // inline here would scan and tokenize every row of the user instead.
  try {
    const ftsItems = await db
      .select(entryColumns)
      .from(entries)
      .where(
        and(
          ...conditions,
          sql`${entries.searchVector} @@ to_tsquery('simple', ${searchTerms})`
        )
      )
      // Order by updatedAt only for consistent cursor pagination
      // FTS still filters by relevance, just doesn't sort by it
      .orderBy(desc(entries.updatedAt))
      .limit(limit + 1)

    if (ftsItems.length > 0) {
      return { items: ftsItems, usedFts: true }
    }
  } catch (error) {
    // FTS failed, fall back to ILIKE
    log.warn("FTS search failed, falling back to ILIKE:", error)
  }

  // Fallback to ILIKE
  const searchPattern = `%${query}%`
  const ilikeItems = await db
    .select(entryColumns)
    .from(entries)
    .where(
      and(
        ...conditions,
        or(
          ilike(entries.title, searchPattern),
          ilike(entries.contentText, searchPattern)
        )
      )
    )
    .orderBy(desc(entries.updatedAt))
    .limit(limit + 1)

  return { items: ilikeItems, usedFts: false }
}

/**
 * Get entry IDs filtered by tags
 */
async function getTagFilteredEntryIds(tagIds: string[]): Promise<string[]> {
  const tagEntries = await db
    .select({ entryId: entryTags.entryId })
    .from(entryTags)
    .where(inArray(entryTags.tagId, tagIds))

  return [...new Set(tagEntries.map((te) => te.entryId))]
}

/**
 * Get entry IDs filtered by sources
 */
async function getSourceFilteredEntryIds(
  sourceIds: string[]
): Promise<string[]> {
  const sourceEntries = await db
    .select({ entryId: entrySources.entryId })
    .from(entrySources)
    .where(inArray(entrySources.sourceId, sourceIds))

  return [...new Set(sourceEntries.map((se) => se.entryId))]
}

/**
 * Combine tag and source filtered entry IDs
 */
function combineEntryIdFilters(
  tagFilteredIds: string[] | null,
  sourceFilteredIds: string[] | null
): string[] | null {
  if (tagFilteredIds !== null && sourceFilteredIds !== null) {
    const tagSet = new Set(tagFilteredIds)
    return sourceFilteredIds.filter((id) => tagSet.has(id))
  }
  if (tagFilteredIds !== null) {
    return tagFilteredIds
  }
  if (sourceFilteredIds !== null) {
    return sourceFilteredIds
  }
  return null
}

/**
 * Build date range conditions
 */
function buildDateRangeConditions(
  dateRange: { from?: Date; to?: Date } | undefined,
  conditions: ReturnType<typeof eq>[]
) {
  if (dateRange?.from) {
    conditions.push(gte(entries.createdAt, dateRange.from))
  }
  if (dateRange?.to) {
    const endDate = new Date(dateRange.to)
    endDate.setDate(endDate.getDate() + 1)
    conditions.push(lte(entries.createdAt, endDate))
  }
}

/**
 * Perform ILIKE search (non-FTS)
 */
async function performIlikeSearch(
  userId: string,
  query: string,
  additionalConditions: ReturnType<typeof eq>[],
  limit: number,
  cursor?: string
): Promise<EntryRow[]> {
  const searchPattern = `%${query}%`
  const conditions = [
    eq(entries.userId, userId),
    isNull(entries.deletedAt),
    ...additionalConditions,
    or(
      ilike(entries.title, searchPattern),
      ilike(entries.contentText, searchPattern)
    )
  ]

  if (cursor) {
    const [cursorEntry] = await db
      .select({ updatedAt: entries.updatedAt })
      .from(entries)
      .where(eq(entries.id, cursor))
      .limit(1)

    if (cursorEntry) {
      conditions.push(lt(entries.updatedAt, cursorEntry.updatedAt))
    }
  }

  return db
    .select(entryColumns)
    .from(entries)
    .where(and(...conditions))
    .orderBy(desc(entries.updatedAt))
    .limit(limit + 1)
}

/**
 * Perform filter-only search (no text query)
 */
async function performFilterOnlySearch(
  userId: string,
  additionalConditions: ReturnType<typeof eq>[],
  limit: number,
  cursor?: string
): Promise<EntryRow[]> {
  const conditions = [
    eq(entries.userId, userId),
    isNull(entries.deletedAt),
    ...additionalConditions
  ]

  if (cursor) {
    const [cursorEntry] = await db
      .select({ updatedAt: entries.updatedAt })
      .from(entries)
      .where(eq(entries.id, cursor))
      .limit(1)

    if (cursorEntry) {
      conditions.push(lt(entries.updatedAt, cursorEntry.updatedAt))
    }
  }

  return db
    .select(entryColumns)
    .from(entries)
    .where(and(...conditions))
    .orderBy(desc(entries.updatedAt))
    .limit(limit + 1)
}

interface AdvancedSearchFilters {
  tagIds?: string[]
  sourceIds?: string[]
  dateRange?: { from?: Date; to?: Date }
  isInbox?: boolean
  isStarred?: boolean
}

/**
 * Create empty result response
 */
function createEmptyResult(query: string, filters: AdvancedSearchFilters) {
  return {
    items: [],
    nextCursor: undefined,
    hasMore: false,
    query,
    filters,
    usedFts: false
  }
}

/**
 * search.entries - Search entries by keyword (title/content)
 * Backward compatible with existing API
 */
export const searchEntries = protectedProcedure
  .input(SearchInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { query, cursor, limit } = input

    const { items, usedFts } = await performFtsSearch(
      userId,
      query,
      [],
      limit,
      cursor
    )

    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? resultItems.at(-1)?.id : undefined

    return {
      items: resultItems,
      nextCursor,
      hasMore,
      query,
      usedFts
    }
  })

/**
 * Build additional conditions based on filters
 */
async function buildFilterConditions(
  filters: AdvancedSearchFilters
): Promise<{ conditions: ReturnType<typeof eq>[]; emptyResult: boolean }> {
  const conditions: ReturnType<typeof eq>[] = []

  // Filter by isInbox/isStarred
  if (filters.isInbox !== undefined) {
    conditions.push(eq(entries.isInbox, filters.isInbox))
  }
  if (filters.isStarred !== undefined) {
    conditions.push(eq(entries.isStarred, filters.isStarred))
  }

  // Filter by date range
  buildDateRangeConditions(filters.dateRange, conditions)

  // Get filtered entry IDs
  let tagFilteredIds: string[] | null = null
  let sourceFilteredIds: string[] | null = null

  if (filters.tagIds && filters.tagIds.length > 0) {
    tagFilteredIds = await getTagFilteredEntryIds(filters.tagIds)
    if (tagFilteredIds.length === 0) {
      return { conditions, emptyResult: true }
    }
  }

  if (filters.sourceIds && filters.sourceIds.length > 0) {
    sourceFilteredIds = await getSourceFilteredEntryIds(filters.sourceIds)
    if (sourceFilteredIds.length === 0) {
      return { conditions, emptyResult: true }
    }
  }

  // Combine filters
  const filteredEntryIds = combineEntryIdFilters(
    tagFilteredIds,
    sourceFilteredIds
  )
  if (filteredEntryIds !== null) {
    if (filteredEntryIds.length === 0) {
      return { conditions, emptyResult: true }
    }
    conditions.push(inArray(entries.id, filteredEntryIds))
  }

  return { conditions, emptyResult: false }
}

/**
 * search.advanced - Advanced search with filters
 */
export const advancedSearch = protectedProcedure
  .input(AdvancedSearchInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { query, cursor, limit, useFts, saveToHistory, ...filterInputs } =
      input

    const filters: AdvancedSearchFilters = {
      tagIds: filterInputs.tagIds,
      sourceIds: filterInputs.sourceIds,
      dateRange: filterInputs.dateRange,
      isInbox: filterInputs.isInbox,
      isStarred: filterInputs.isStarred
    }

    // Build filter conditions
    const { conditions: additionalConditions, emptyResult } =
      await buildFilterConditions(filters)

    if (emptyResult) {
      return createEmptyResult(query ?? "", filters)
    }

    let items: EntryRow[]
    let searchUsedFts = false

    // Perform search based on query presence
    if (query && query.trim().length > 0) {
      if (useFts) {
        const result = await performFtsSearch(
          userId,
          query,
          additionalConditions,
          limit,
          cursor
        )
        items = result.items
        searchUsedFts = result.usedFts
      } else {
        items = await performIlikeSearch(
          userId,
          query,
          additionalConditions,
          limit,
          cursor
        )
      }
    } else {
      items = await performFilterOnlySearch(
        userId,
        additionalConditions,
        limit,
        cursor
      )
    }

    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? resultItems.at(-1)?.id : undefined

    // Save to history if requested
    if (saveToHistory && query && query.trim().length > 0) {
      try {
        await db.insert(searchHistory).values({
          id: nanoid(),
          userId,
          query: query.trim(),
          filters: JSON.stringify(filters),
          resultCount: resultItems.length
        })
      } catch {
        // Ignore history save errors
      }
    }

    return {
      items: resultItems,
      nextCursor,
      hasMore,
      query: query ?? "",
      filters,
      usedFts: searchUsedFts
    }
  })

/**
 * search.saveHistory - Save a search to history
 */
export const saveSearchHistory = protectedProcedure
  .input(SaveHistoryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { query, filters, resultCount } = input

    const [history] = await db
      .insert(searchHistory)
      .values({
        id: nanoid(),
        userId,
        query: query.trim(),
        filters: filters ? JSON.stringify(filters) : null,
        resultCount: resultCount ?? null
      })
      .returning()

    return history
  })

/**
 * search.getHistory - Get recent search history
 */
export const getSearchHistory = protectedProcedure
  .input(GetHistoryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { limit } = input

    const history = await db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit)

    return history.map((h) => ({
      ...h,
      filters: h.filters ? JSON.parse(h.filters) : null
    }))
  })

/**
 * search.deleteHistory - Delete search history
 */
export const deleteSearchHistory = protectedProcedure
  .input(DeleteHistoryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id, deleteAll } = input

    if (deleteAll) {
      await db.delete(searchHistory).where(eq(searchHistory.userId, userId))
      return { success: true, deletedAll: true }
    }

    if (id) {
      await db
        .delete(searchHistory)
        .where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)))
      return { success: true, deletedId: id }
    }

    return { success: false }
  })

/**
 * search.getSuggestions - Get search suggestions based on history
 */
export const getSearchSuggestions = protectedProcedure
  .input(GetSuggestionsInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { query, limit } = input

    if (query && query.trim().length > 0) {
      // Get suggestions matching the query prefix
      const pattern = `${query.trim()}%`
      const suggestions = await db
        .select({
          query: searchHistory.query,
          count: sql<number>`count(*)::int`
        })
        .from(searchHistory)
        .where(
          and(
            eq(searchHistory.userId, userId),
            ilike(searchHistory.query, pattern)
          )
        )
        .groupBy(searchHistory.query)
        .orderBy(sql`count(*) DESC`)
        .limit(limit)

      return suggestions
    }

    // Get most frequent recent searches
    const suggestions = await db
      .select({
        query: searchHistory.query,
        count: sql<number>`count(*)::int`
      })
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .groupBy(searchHistory.query)
      .orderBy(sql`count(*) DESC`)
      .limit(limit)

    return suggestions
  })

/**
 * Search router - all search-related procedures
 */
export const searchRouter = {
  entries: searchEntries,
  advanced: advancedSearch,
  saveHistory: saveSearchHistory,
  getHistory: getSearchHistory,
  deleteHistory: deleteSearchHistory,
  getSuggestions: getSearchSuggestions
}
