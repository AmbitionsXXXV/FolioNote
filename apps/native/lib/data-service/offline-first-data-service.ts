/**
 * Offline-First Data Service
 *
 * Implementation of DataService that provides offline-first experience.
 * Operations are performed locally first, then synced to server in background.
 * This enables optimistic updates and works seamlessly offline.
 */

import { client } from "../../utils/orpc"
import type { Entry, Source, Tag } from "../db/schema"
import {
  entriesRepository,
  reviewRepository,
  sourcesRepository,
  tagsRepository
} from "../repositories"
import type { ReviewRating } from "../repositories/review-repository"
import { getDeviceTimeZone } from "../study-day"
import { pendingOperations } from "../sync"
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

/**
 * Check if network is available
 */
async function isNetworkAvailable(): Promise<boolean> {
  try {
    // Simple connectivity check
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL}/health`, {
      method: "HEAD",
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return true
  } catch {
    return false
  }
}

/**
 * Create an offline-first data service
 * Operations are performed locally first, then queued for sync
 */
export function createOfflineFirstDataService(
  localUserId: string
): DataService {
  return {
    entries: {
      async list(input: ListEntriesInput): Promise<PaginatedList<Entry>> {
        // Always read from local database for consistency
        const result = await entriesRepository.list({
          userId: localUserId,
          filter: input.filter,
          search: input.search,
          tagId: input.tagId,
          limit: input.limit,
          cursor: input.cursor
        })
        return {
          items: result.items,
          hasMore: result.hasMore,
          cursor: result.cursor
        }
      },

      get(id: string): Promise<Entry | null> {
        return entriesRepository.findById(id)
      },

      async create(input: CreateEntryInput): Promise<Entry> {
        // Create locally first (optimistic)
        const entry = await entriesRepository.create({
          userId: localUserId,
          ...input
        })

        // Queue for sync
        await pendingOperations.add("entry", entry.id, "create", entry)

        // Try to sync immediately if online
        if (await isNetworkAvailable()) {
          try {
            await client.entries.create({
              title: entry.title,
              contentJson: entry.contentJson ?? undefined,
              isInbox: entry.isInbox
            })
            await entriesRepository.markSynced(entry.id)
            await pendingOperations.remove(entry.id)
          } catch {
            // Sync failed, will retry later
          }
        }

        return entry
      },

      async update(id: string, input: UpdateEntryInput): Promise<Entry | null> {
        // Update locally first (optimistic)
        const entry = await entriesRepository.update(id, input)
        if (!entry) {
          return null
        }

        // Queue for sync
        await pendingOperations.add("entry", id, "update", entry)

        // Try to sync immediately if online
        if (await isNetworkAvailable()) {
          try {
            await client.entries.update({
              id,
              title: input.title,
              contentJson: input.contentJson,
              isInbox: input.isInbox,
              isStarred: input.isStarred,
              isPinned: input.isPinned,
              expectedVersion: input.version
            })
            await entriesRepository.markSynced(id)
            await pendingOperations.remove(id)
          } catch {
            // Sync failed, will retry later
          }
        }

        return entry
      },

      async delete(id: string): Promise<boolean> {
        // Get entry before deletion for sync
        const entry = await entriesRepository.findById(id)
        if (!entry) {
          return false
        }

        // Delete locally first (optimistic)
        const success = await entriesRepository.delete(id)
        if (!success) {
          return false
        }

        // Queue for sync
        await pendingOperations.add("entry", id, "delete", { id })

        // Try to sync immediately if online
        if (await isNetworkAvailable()) {
          try {
            await client.entries.delete({ id })
            await pendingOperations.remove(id)
          } catch {
            // Sync failed, will retry later
          }
        }

        return true
      },

      async toggleStarred(id: string): Promise<Entry | null> {
        const entry = await entriesRepository.toggleStarred(id)
        if (!entry) {
          return null
        }

        // Queue for sync
        await pendingOperations.add("entry", id, "update", entry)

        // Try to sync immediately
        if (await isNetworkAvailable()) {
          try {
            await client.entries.update({ id, isStarred: entry.isStarred })
            await entriesRepository.markSynced(id)
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return entry
      },

      async moveToLibrary(id: string): Promise<Entry | null> {
        const entry = await entriesRepository.moveToLibrary(id)
        if (!entry) {
          return null
        }

        await pendingOperations.add("entry", id, "update", entry)

        if (await isNetworkAvailable()) {
          try {
            await client.entries.update({ id, isInbox: false })
            await entriesRepository.markSynced(id)
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return entry
      },

      async moveToInbox(id: string): Promise<Entry | null> {
        const entry = await entriesRepository.moveToInbox(id)
        if (!entry) {
          return null
        }

        await pendingOperations.add("entry", id, "update", entry)

        if (await isNetworkAvailable()) {
          try {
            await client.entries.update({ id, isInbox: true })
            await entriesRepository.markSynced(id)
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return entry
      }
    },

    tags: {
      async list(input: ListTagsInput): Promise<PaginatedList<Tag>> {
        const result = await tagsRepository.list({
          userId: localUserId,
          search: input.search,
          limit: input.limit,
          cursor: input.cursor
        })
        return {
          items: result.items,
          hasMore: result.hasMore
        }
      },

      get(id: string): Promise<Tag | null> {
        return tagsRepository.findById(id)
      },

      async create(input: CreateTagInput): Promise<Tag> {
        const tag = await tagsRepository.create({
          userId: localUserId,
          ...input
        })

        await pendingOperations.add("tag", tag.id, "create", tag)

        if (await isNetworkAvailable()) {
          try {
            await client.tags.create({
              name: tag.name,
              color: tag.color ?? undefined
            })
            await tagsRepository.markSynced(tag.id)
            await pendingOperations.remove(tag.id)
          } catch {
            // Sync failed
          }
        }

        return tag
      },

      async update(id: string, input: UpdateTagInput): Promise<Tag | null> {
        const tag = await tagsRepository.update(id, input)
        if (!tag) {
          return null
        }

        await pendingOperations.add("tag", id, "update", tag)

        if (await isNetworkAvailable()) {
          try {
            await client.tags.update({
              id,
              name: input.name,
              color: input.color
            })
            await tagsRepository.markSynced(id)
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return tag
      },

      async delete(id: string): Promise<boolean> {
        const success = await tagsRepository.delete(id)
        if (!success) {
          return false
        }

        await pendingOperations.add("tag", id, "delete", { id })

        if (await isNetworkAvailable()) {
          try {
            await client.tags.delete({ id })
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return true
      },

      getForEntry(entryId: string): Promise<Tag[]> {
        return tagsRepository.getTagsForEntry(entryId)
      },

      async addToEntry(entryId: string, tagId: string): Promise<void> {
        await tagsRepository.addTagToEntry(entryId, tagId)

        await pendingOperations.add(
          "entryTag",
          `${entryId}_${tagId}`,
          "create",
          {
            entryId,
            tagId
          }
        )

        if (await isNetworkAvailable()) {
          try {
            await client.entries.addTag({ entryId, tagId })
            await pendingOperations.remove(`${entryId}_${tagId}`)
          } catch {
            // Sync failed
          }
        }
      },

      async removeFromEntry(entryId: string, tagId: string): Promise<void> {
        await tagsRepository.removeTagFromEntry(entryId, tagId)

        await pendingOperations.add(
          "entryTag",
          `${entryId}_${tagId}`,
          "delete",
          {
            entryId,
            tagId
          }
        )

        if (await isNetworkAvailable()) {
          try {
            await client.entries.removeTag({ entryId, tagId })
            await pendingOperations.remove(`${entryId}_${tagId}`)
          } catch {
            // Sync failed
          }
        }
      }
    },

    sources: {
      async list(input: ListSourcesInput): Promise<PaginatedList<Source>> {
        const result = await sourcesRepository.list({
          userId: localUserId,
          type: input.type,
          search: input.search,
          limit: input.limit,
          cursor: input.cursor
        })
        return {
          items: result.items,
          hasMore: result.hasMore
        }
      },

      get(id: string): Promise<Source | null> {
        return sourcesRepository.findById(id)
      },

      async create(input: CreateSourceInput): Promise<Source> {
        const source = await sourcesRepository.create({
          userId: localUserId,
          ...input
        })

        await pendingOperations.add("source", source.id, "create", source)

        if (await isNetworkAvailable()) {
          try {
            await client.sources.create({
              title: source.title,
              type: source.type as
                | "link"
                | "pdf"
                | "book"
                | "article"
                | "video"
                | "podcast"
                | "other",
              url: source.url ?? undefined,
              author: source.author ?? undefined
            })
            await sourcesRepository.markSynced(source.id)
            await pendingOperations.remove(source.id)
          } catch {
            // Sync failed
          }
        }

        return source
      },

      async update(
        id: string,
        input: UpdateSourceInput
      ): Promise<Source | null> {
        const source = await sourcesRepository.update(id, input)
        if (!source) {
          return null
        }

        await pendingOperations.add("source", id, "update", source)

        if (await isNetworkAvailable()) {
          try {
            await client.sources.update({
              id,
              title: input.title,
              url: input.url,
              author: input.author
            })
            await sourcesRepository.markSynced(id)
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return source
      },

      async delete(id: string): Promise<boolean> {
        const success = await sourcesRepository.delete(id)
        if (!success) {
          return false
        }

        await pendingOperations.add("source", id, "delete", { id })

        if (await isNetworkAvailable()) {
          try {
            await client.sources.delete({ id })
            await pendingOperations.remove(id)
          } catch {
            // Sync failed
          }
        }

        return true
      },

      getForEntry(entryId: string): Promise<Source[]> {
        return sourcesRepository.getSourcesForEntry(entryId)
      },

      async addToEntry(
        entryId: string,
        sourceId: string,
        position?: string
      ): Promise<void> {
        await sourcesRepository.addSourceToEntry(entryId, sourceId, position)

        await pendingOperations.add(
          "entrySource",
          `${entryId}_${sourceId}`,
          "create",
          { entryId, sourceId, position }
        )

        if (await isNetworkAvailable()) {
          try {
            await client.sources.addToEntry({ entryId, sourceId, position })
            await pendingOperations.remove(`${entryId}_${sourceId}`)
          } catch {
            // Sync failed
          }
        }
      },

      async removeFromEntry(entryId: string, sourceId: string): Promise<void> {
        await sourcesRepository.removeSourceFromEntry(entryId, sourceId)

        await pendingOperations.add(
          "entrySource",
          `${entryId}_${sourceId}`,
          "delete",
          { entryId, sourceId }
        )

        if (await isNetworkAvailable()) {
          try {
            await client.sources.removeFromEntry({ entryId, sourceId })
            await pendingOperations.remove(`${entryId}_${sourceId}`)
          } catch {
            // Sync failed
          }
        }
      }
    },

    review: {
      getQueue(input: GetQueueInput): Promise<Entry[]> {
        return reviewRepository.getQueue({
          userId: localUserId,
          mode: input.mode,
          limit: input.limit,
          tzOffset: input.tzOffset
        })
      },

      async markReviewed(
        entryId: string,
        rating: ReviewRating = "good"
      ): Promise<void> {
        // Mark locally first
        await reviewRepository.markReviewed(localUserId, entryId, rating)

        // Queue for sync
        await pendingOperations.add("reviewEvent", entryId, "create", {
          entryId,
          rating
        })

        // Try to sync immediately
        if (await isNetworkAvailable()) {
          try {
            await client.review.markReviewed({
              entryId,
              rating,
              timeZone: getDeviceTimeZone()
            })
            await reviewRepository.markStateSynced(entryId)
            await pendingOperations.remove(entryId)
          } catch {
            // Sync failed
          }
        }
      },

      async snooze(
        entryId: string,
        preset: SnoozePreset | number
      ): Promise<void> {
        // Snooze locally first
        await reviewRepository.snooze(localUserId, entryId, preset)

        // Queue for sync
        await pendingOperations.add("reviewState", entryId, "update", {
          entryId,
          preset
        })

        // Try to sync immediately
        if (await isNetworkAvailable()) {
          try {
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
            await reviewRepository.markStateSynced(entryId)
            await pendingOperations.remove(entryId)
          } catch {
            // Sync failed
          }
        }
      },

      getTodayStats(tzOffset = 0): Promise<TodayStats> {
        return reviewRepository.getTodayStats(localUserId, tzOffset)
      },

      getDueStats(tzOffset = 0): Promise<DueStats> {
        return reviewRepository.getDueStats(localUserId, tzOffset)
      }
    }
  }
}
