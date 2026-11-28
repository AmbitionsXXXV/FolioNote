/**
 * Remote Data Service
 *
 * Implementation of DataService using remote API (oRPC).
 * Used when the user is logged in and connected to the server.
 */

import { client } from "../../utils/orpc"
import type { Entry, Source, Tag } from "../db/schema"
import type { ReviewRating } from "../repositories/review-repository"
import { getDeviceTimeZone } from "../study-day"
import type {
  CreateEntryInput,
  CreateSourceInput,
  CreateTagInput,
  DataService,
  DueStats,
  GetQueueInput,
  ListEntriesInput,
  ListSourcesInput,
  ListTagsInput,
  PaginatedList,
  SnoozePreset,
  TodayStats,
  UpdateEntryInput,
  UpdateSourceInput,
  UpdateTagInput
} from "./types"

const DEFAULT_ENTRIES_LIMIT = 20
const DEFAULT_TAGS_LIMIT = 50
const DEFAULT_SOURCES_LIMIT = 20
const MAX_REMOTE_LIMIT = 100

interface CursorPage<T> {
  hasMore: boolean
  items: T[]
  nextCursor?: string
}

interface ServerEntry {
  contentJson?: string | null
  contentText?: string | null
  createdAt: string | Date
  deletedAt?: string | Date | null
  id: string
  isInbox: boolean
  isPinned: boolean
  isStarred: boolean
  title: string
  updatedAt: string | Date
  userId: string
  version: string
}

interface ServerTag {
  color?: string | null
  createdAt: string | Date
  id: string
  name: string
  updatedAt: string | Date
  userId: string
}

interface ServerSource {
  author?: string | null
  createdAt: string | Date
  deletedAt?: string | Date | null
  id: string
  metadata?: string | null
  publishedAt?: string | Date | null
  title: string
  type: string
  updatedAt: string | Date
  url?: string | null
  userId: string
}

/**
 * Convert server entry to local Entry type
 */
function toLocalEntry(serverEntry: ServerEntry): Entry {
  return {
    id: serverEntry.id,
    userId: serverEntry.userId,
    title: serverEntry.title,
    contentJson: serverEntry.contentJson ?? null,
    contentText: serverEntry.contentText ?? null,
    isInbox: serverEntry.isInbox,
    isStarred: serverEntry.isStarred,
    isPinned: serverEntry.isPinned,
    createdAt: new Date(serverEntry.createdAt),
    updatedAt: new Date(serverEntry.updatedAt),
    version: serverEntry.version,
    deletedAt: serverEntry.deletedAt ? new Date(serverEntry.deletedAt) : null,
    syncStatus: "synced",
    lastSyncedAt: new Date()
  }
}

/**
 * Convert server tag to local Tag type
 */
function toLocalTag(serverTag: ServerTag): Tag {
  return {
    id: serverTag.id,
    userId: serverTag.userId,
    name: serverTag.name,
    color: serverTag.color ?? null,
    createdAt: new Date(serverTag.createdAt),
    updatedAt: new Date(serverTag.updatedAt),
    syncStatus: "synced",
    lastSyncedAt: new Date()
  }
}

/**
 * Convert server source to local Source type
 */
function toLocalSource(serverSource: ServerSource): Source {
  return {
    id: serverSource.id,
    userId: serverSource.userId,
    type: serverSource.type,
    title: serverSource.title,
    url: serverSource.url ?? null,
    author: serverSource.author ?? null,
    publishedAt: serverSource.publishedAt
      ? new Date(serverSource.publishedAt)
      : null,
    metadata: serverSource.metadata ?? null,
    createdAt: new Date(serverSource.createdAt),
    updatedAt: new Date(serverSource.updatedAt),
    deletedAt: serverSource.deletedAt ? new Date(serverSource.deletedAt) : null,
    syncStatus: "synced",
    lastSyncedAt: new Date()
  }
}

function normalizeSearchQuery(search: string | undefined): string | undefined {
  const trimmed = search?.trim()
  return trimmed ? trimmed.toLowerCase() : undefined
}

function includesInsensitive(
  value: string | null | undefined,
  query: string
): boolean {
  if (!value) {
    return false
  }
  return value.toLowerCase().includes(query)
}

function doesEntryMatchFilter(
  entry: Entry,
  filter: ListEntriesInput["filter"]
): boolean {
  switch (filter) {
    case "inbox": {
      return entry.isInbox
    }
    case "starred": {
      return entry.isStarred
    }
    case "library": {
      return !entry.isInbox
    }
    default: {
      return true
    }
  }
}

function doesEntryMatchSearch(entry: Entry, query: string): boolean {
  return (
    includesInsensitive(entry.title, query) ||
    includesInsensitive(entry.contentText, query)
  )
}

function doesTagMatchSearch(tag: Tag, query: string): boolean {
  return includesInsensitive(tag.name, query)
}

function doesSourceMatchSearch(source: Source, query: string): boolean {
  return includesInsensitive(source.title, query)
}

async function collectPaginatedIdItems<
  TServerItem,
  TLocalItem extends { id: string }
>(options: {
  initialCursor: string | undefined
  limit: number
  serverLimit: number
  fetchPage: (
    cursor: string | undefined,
    limit: number
  ) => Promise<CursorPage<TServerItem>>
  toLocal: (item: TServerItem) => TLocalItem
  shouldInclude: (item: TLocalItem) => boolean
}): Promise<PaginatedList<TLocalItem>> {
  let cursor = options.initialCursor
  const items: TLocalItem[] = []
  let hasMore = true
  let nextCursor: string | undefined

  while (items.length < options.limit && hasMore) {
    const result = await options.fetchPage(cursor, options.serverLimit)

    for (const serverItem of result.items) {
      const localItem = options.toLocal(serverItem)
      if (!options.shouldInclude(localItem)) {
        continue
      }
      items.push(localItem)
      nextCursor = localItem.id
      if (items.length >= options.limit) {
        break
      }
    }

    if (items.length >= options.limit) {
      return { items, hasMore: true, cursor: nextCursor }
    }

    ;({ hasMore } = result)
    cursor = result.nextCursor
    if (!cursor) {
      break
    }
  }

  return { items, hasMore, cursor: nextCursor }
}

/**
 * Create a remote data service
 */
export function createRemoteDataService(): DataService {
  return {
    entries: {
      list(input: ListEntriesInput): Promise<PaginatedList<Entry>> {
        const limit = input.limit ?? DEFAULT_ENTRIES_LIMIT
        const rawSearchQuery = input.search?.trim()
        const normalizedSearchQuery = normalizeSearchQuery(rawSearchQuery)

        // Prefer server-side search when possible (tagId + search is not supported remotely)
        if (rawSearchQuery && !input.tagId) {
          const serverLimit = Math.min(limit * 5, MAX_REMOTE_LIMIT)
          return collectPaginatedIdItems<ServerEntry, Entry>({
            initialCursor: input.cursor,
            limit,
            serverLimit,
            fetchPage: async (cursor, pageLimit) => {
              const result = await client.search.entries({
                query: rawSearchQuery,
                limit: pageLimit,
                cursor
              })
              return {
                items: result.items as ServerEntry[],
                hasMore: result.hasMore,
                nextCursor: result.nextCursor
              }
            },
            toLocal: (serverEntry) => toLocalEntry(serverEntry),
            shouldInclude: (entry) => doesEntryMatchFilter(entry, input.filter)
          })
        }

        // Map 'library' filter to server 'all' + client-side filtering
        const serverFilter = input.filter === "library" ? "all" : input.filter
        const needsClientSideFiltering =
          input.filter === "library" ||
          (normalizedSearchQuery !== undefined && input.tagId !== undefined)
        const serverLimit = Math.min(
          needsClientSideFiltering ? limit * 5 : limit,
          MAX_REMOTE_LIMIT
        )

        return collectPaginatedIdItems<ServerEntry, Entry>({
          initialCursor: input.cursor,
          limit,
          serverLimit,
          fetchPage: async (cursor, pageLimit) => {
            const result = await client.entries.list({
              filter: serverFilter,
              tagId: input.tagId,
              limit: pageLimit,
              cursor
            })
            return {
              items: result.items as ServerEntry[],
              hasMore: result.hasMore,
              nextCursor: result.nextCursor
            }
          },
          toLocal: (serverEntry) => toLocalEntry(serverEntry),
          shouldInclude: (entry) => {
            if (!doesEntryMatchFilter(entry, input.filter)) {
              return false
            }
            if (!normalizedSearchQuery) {
              return true
            }
            return doesEntryMatchSearch(entry, normalizedSearchQuery)
          }
        })
      },

      async get(id: string): Promise<Entry | null> {
        try {
          const result = await client.entries.get({ id })
          return toLocalEntry(result as ServerEntry)
        } catch {
          return null
        }
      },

      async create(input: CreateEntryInput): Promise<Entry> {
        const result = await client.entries.create(input)
        return toLocalEntry(result as ServerEntry)
      },

      async update(id: string, input: UpdateEntryInput): Promise<Entry | null> {
        try {
          const { version, ...updateData } = input
          const result = await client.entries.update({
            id,
            ...updateData,
            expectedVersion: version
          })
          return toLocalEntry(result as ServerEntry)
        } catch {
          return null
        }
      },

      async delete(id: string): Promise<boolean> {
        try {
          await client.entries.delete({ id })
          return true
        } catch {
          return false
        }
      },

      async toggleStarred(id: string): Promise<Entry | null> {
        try {
          const entry = await this.get(id)
          if (!entry) {
            return null
          }
          const result = await client.entries.update({
            id,
            isStarred: !entry.isStarred
          })
          return toLocalEntry(result as ServerEntry)
        } catch {
          return null
        }
      },

      async moveToLibrary(id: string): Promise<Entry | null> {
        try {
          const result = await client.entries.update({ id, isInbox: false })
          return toLocalEntry(result as ServerEntry)
        } catch {
          return null
        }
      },

      async moveToInbox(id: string): Promise<Entry | null> {
        try {
          const result = await client.entries.update({ id, isInbox: true })
          return toLocalEntry(result as ServerEntry)
        } catch {
          return null
        }
      }
    },

    tags: {
      async list(input: ListTagsInput): Promise<PaginatedList<Tag>> {
        const limit = input.limit ?? DEFAULT_TAGS_LIMIT
        const normalizedSearchQuery = normalizeSearchQuery(input.search)

        const result = await client.tags.list()
        const allTags = result.map((tag) => toLocalTag(tag as ServerTag))
        const filteredTags = normalizedSearchQuery
          ? allTags.filter((tag) =>
              doesTagMatchSearch(tag, normalizedSearchQuery)
            )
          : allTags

        const startIndex = input.cursor
          ? Math.max(
              0,
              filteredTags.findIndex((tag) => tag.id === input.cursor) + 1
            )
          : 0

        const items = filteredTags.slice(startIndex, startIndex + limit)
        const hasMore = startIndex + limit < filteredTags.length
        const cursor = hasMore ? items.at(-1)?.id : undefined

        return {
          items,
          hasMore,
          cursor
        }
      },

      async get(id: string): Promise<Tag | null> {
        try {
          const result = await client.tags.get({ id })
          return toLocalTag(result as ServerTag)
        } catch {
          return null
        }
      },

      async create(input: CreateTagInput): Promise<Tag> {
        const result = await client.tags.create(input)
        return toLocalTag(result as ServerTag)
      },

      async update(id: string, input: UpdateTagInput): Promise<Tag | null> {
        try {
          const result = await client.tags.update({ id, ...input })
          return toLocalTag(result as ServerTag)
        } catch {
          return null
        }
      },

      async delete(id: string): Promise<boolean> {
        try {
          await client.tags.delete({ id })
          return true
        } catch {
          return false
        }
      },

      async getForEntry(entryId: string): Promise<Tag[]> {
        const result = await client.entries.getTags({ id: entryId })
        return result.map((tag) => toLocalTag(tag as ServerTag))
      },

      async addToEntry(entryId: string, tagId: string): Promise<void> {
        await client.entries.addTag({ entryId, tagId })
      },

      async removeFromEntry(entryId: string, tagId: string): Promise<void> {
        await client.entries.removeTag({ entryId, tagId })
      }
    },

    sources: {
      list(input: ListSourcesInput): Promise<PaginatedList<Source>> {
        const limit = input.limit ?? DEFAULT_SOURCES_LIMIT
        const normalizedSearchQuery = normalizeSearchQuery(input.search)
        const serverLimit = Math.min(
          normalizedSearchQuery ? limit * 5 : limit,
          MAX_REMOTE_LIMIT
        )

        return collectPaginatedIdItems<ServerSource, Source>({
          initialCursor: input.cursor,
          limit,
          serverLimit,
          fetchPage: async (cursor, pageLimit) => {
            const result = await client.sources.list({
              type: input.type,
              limit: pageLimit,
              cursor
            })
            return {
              items: result.items as ServerSource[],
              hasMore: result.hasMore,
              nextCursor: result.nextCursor
            }
          },
          toLocal: (serverSource) => toLocalSource(serverSource),
          shouldInclude: (source) =>
            normalizedSearchQuery
              ? doesSourceMatchSearch(source, normalizedSearchQuery)
              : true
        })
      },

      async get(id: string): Promise<Source | null> {
        try {
          const result = await client.sources.get({ id })
          return toLocalSource(result as ServerSource)
        } catch {
          return null
        }
      },

      async create(input: CreateSourceInput): Promise<Source> {
        const result = await client.sources.create(input)
        return toLocalSource(result as ServerSource)
      },

      async update(
        id: string,
        input: UpdateSourceInput
      ): Promise<Source | null> {
        try {
          const result = await client.sources.update({ id, ...input })
          return toLocalSource(result as ServerSource)
        } catch {
          return null
        }
      },

      async delete(id: string): Promise<boolean> {
        try {
          await client.sources.delete({ id })
          return true
        } catch {
          return false
        }
      },

      async getForEntry(entryId: string): Promise<Source[]> {
        const result = await client.sources.getEntrySources({ entryId })
        return result.map((source) => toLocalSource(source as ServerSource))
      },

      async addToEntry(
        entryId: string,
        sourceId: string,
        position?: string
      ): Promise<void> {
        await client.sources.addToEntry({ entryId, sourceId, position })
      },

      async removeFromEntry(entryId: string, sourceId: string): Promise<void> {
        await client.sources.removeFromEntry({ entryId, sourceId })
      }
    },

    review: {
      async getQueue(input: GetQueueInput): Promise<Entry[]> {
        const result = await client.review.getQueue({
          rule: input.mode ?? "due",
          limit: input.limit,
          tzOffset: input.tzOffset
        })
        return result.items.map((item) => toLocalEntry(item as ServerEntry))
      },

      async markReviewed(
        entryId: string,
        rating: ReviewRating = "good"
      ): Promise<void> {
        await client.review.markReviewed({
          entryId,
          rating,
          timeZone: getDeviceTimeZone()
        })
      },

      async snooze(
        entryId: string,
        preset: SnoozePreset | number
      ): Promise<void> {
        if (typeof preset === "number") {
          const untilAt = new Date()
          untilAt.setDate(untilAt.getDate() + preset)
          await client.review.snooze({
            entryId,
            untilAt: untilAt.toISOString()
          })
        } else {
          await client.review.snooze({ entryId, preset })
        }
      },

      getTodayStats(tzOffset = 0): Promise<TodayStats> {
        return client.review.getTodayStats({ tzOffset })
      },

      getDueStats(tzOffset = 0): Promise<DueStats> {
        return client.review.getDueStats({ tzOffset })
      }
    }
  }
}
