/**
 * Sync Service
 *
 * Core synchronization service that handles data sync between local SQLite
 * and remote server. Supports incremental sync, conflict resolution, and
 * offline operation queuing.
 */

import * as SecureStore from "expo-secure-store"

import { client } from "../../utils/orpc"
import type { Entry, Source, Tag } from "../db/schema"
import {
  entriesRepository,
  reviewRepository,
  sourcesRepository,
  tagsRepository
} from "../repositories"
import { getDeviceTimeZone } from "../study-day"
import { pendingOperations } from "./pending-operations"
import type {
  ConflictStrategy,
  SyncConflict,
  SyncEntityResult,
  SyncMetadata,
  SyncOptions,
  SyncProgress,
  SyncResult,
  SyncState
} from "./types"

const SYNC_METADATA_KEY = "folio_sync_metadata"
const CONFLICTS_KEY = "folio_sync_conflicts"

/**
 * Load sync metadata from storage
 */
async function loadSyncMetadata(): Promise<SyncMetadata> {
  try {
    const stored = await SecureStore.getItemAsync(SYNC_METADATA_KEY)
    if (!stored) {
      return {
        lastSyncAt: null,
        lastSyncResult: null,
        pendingOperationsCount: 0,
        conflictsCount: 0
      }
    }

    const parsed = JSON.parse(stored) as {
      lastSyncAt: string | null
      lastSyncResult: "success" | "partial" | "failed" | null
      pendingOperationsCount: number
      conflictsCount: number
    }

    return {
      ...parsed,
      lastSyncAt: parsed.lastSyncAt ? new Date(parsed.lastSyncAt) : null
    }
  } catch (error) {
    console.error("Failed to load sync metadata:", error)
    return {
      lastSyncAt: null,
      lastSyncResult: null,
      pendingOperationsCount: 0,
      conflictsCount: 0
    }
  }
}

/**
 * Save sync metadata to storage
 */
async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    const serialized = JSON.stringify({
      ...metadata,
      lastSyncAt: metadata.lastSyncAt?.toISOString() ?? null
    })
    await SecureStore.setItemAsync(SYNC_METADATA_KEY, serialized)
  } catch (error) {
    console.error("Failed to save sync metadata:", error)
  }
}

/**
 * Load conflicts from storage
 */
async function loadConflicts(): Promise<SyncConflict[]> {
  try {
    const stored = await SecureStore.getItemAsync(CONFLICTS_KEY)
    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored) as {
      id: string
      entityType: SyncConflict["entityType"]
      entityId: string
      localData: string
      remoteData: string
      localUpdatedAt: string
      remoteUpdatedAt: string
      createdAt: string
      resolvedAt?: string
      resolution?: ConflictStrategy
    }[]

    return parsed.map((c) => ({
      ...c,
      localUpdatedAt: new Date(c.localUpdatedAt),
      remoteUpdatedAt: new Date(c.remoteUpdatedAt),
      createdAt: new Date(c.createdAt),
      resolvedAt: c.resolvedAt ? new Date(c.resolvedAt) : undefined
    }))
  } catch (error) {
    console.error("Failed to load conflicts:", error)
    return []
  }
}

/**
 * Save conflicts to storage
 */
async function saveConflicts(conflicts: SyncConflict[]): Promise<void> {
  try {
    const serialized = JSON.stringify(
      conflicts.map((c) => ({
        ...c,
        localUpdatedAt: c.localUpdatedAt.toISOString(),
        remoteUpdatedAt: c.remoteUpdatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        resolvedAt: c.resolvedAt?.toISOString()
      }))
    )
    await SecureStore.setItemAsync(CONFLICTS_KEY, serialized)
  } catch (error) {
    console.error("Failed to save conflicts:", error)
  }
}

/**
 * Generate conflict ID
 */
function generateConflictId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `conflict_${timestamp}_${randomPart}`
}

/**
 * Sync Service
 */
class SyncService {
  private _state: SyncState = "idle"
  private readonly _listeners = new Set<(state: SyncState) => void>()

  /**
   * Get current sync state
   */
  get state(): SyncState {
    return this._state
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /**
   * Update sync state and notify listeners
   */
  private setState(state: SyncState): void {
    this._state = state
    for (const listener of this._listeners) {
      listener(state)
    }
  }

  /**
   * Get sync metadata
   */
  async getMetadata(): Promise<SyncMetadata> {
    const metadata = await loadSyncMetadata()
    const pendingCount = await pendingOperations.getCount()
    const conflicts = await loadConflicts()

    return {
      ...metadata,
      pendingOperationsCount: pendingCount,
      conflictsCount: conflicts.filter((c) => !c.resolvedAt).length
    }
  }

  /**
   * Get unresolved conflicts
   */
  async getConflicts(): Promise<SyncConflict[]> {
    const conflicts = await loadConflicts()
    return conflicts.filter((c) => !c.resolvedAt)
  }

  /**
   * Resolve a conflict with the specified strategy
   */
  async resolveConflict(
    conflictId: string,
    strategy: ConflictStrategy
  ): Promise<void> {
    const conflicts = await loadConflicts()
    const conflict = conflicts.find((c) => c.id === conflictId)

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`)
    }

    if (strategy === "local") {
      // Upload local data to server
      await this.uploadEntity(
        conflict.entityType,
        conflict.entityId,
        JSON.parse(conflict.localData)
      )
    } else if (strategy === "remote") {
      // Download remote data to local
      await this.downloadEntity(
        conflict.entityType,
        conflict.entityId,
        JSON.parse(conflict.remoteData)
      )
    }
    // For 'manual', the user has already resolved it externally

    // Mark conflict as resolved
    const index = conflicts.findIndex((c) => c.id === conflictId)
    conflicts[index] = {
      ...conflicts[index],
      resolvedAt: new Date(),
      resolution: strategy
    }

    await saveConflicts(conflicts)
  }

  /**
   * Upload a single entity to server
   */
  private async uploadEntity(
    entityType: SyncConflict["entityType"],
    _entityId: string,
    data: unknown
  ): Promise<void> {
    switch (entityType) {
      case "entry": {
        const entry = data as Entry
        await client.entries.update({
          id: entry.id,
          title: entry.title,
          contentJson: entry.contentJson ?? undefined,
          isInbox: entry.isInbox,
          isStarred: entry.isStarred,
          isPinned: entry.isPinned
        })
        break
      }
      case "tag": {
        const tag = data as Tag
        await client.tags.update({
          id: tag.id,
          name: tag.name,
          color: tag.color ?? undefined
        })
        break
      }
      case "source": {
        const source = data as Source
        await client.sources.update({
          id: source.id,
          title: source.title,
          url: source.url ?? undefined,
          author: source.author ?? undefined
        })
        break
      }
      default: {
        console.warn(`Upload not implemented for entity type: ${entityType}`)
      }
    }
  }

  /**
   * Download a single entity from server to local
   */
  private async downloadEntity(
    entityType: SyncConflict["entityType"],
    entityId: string,
    data: unknown
  ): Promise<void> {
    switch (entityType) {
      case "entry": {
        const entry = data as Entry
        await entriesRepository.update(entityId, {
          title: entry.title,
          contentJson: entry.contentJson ?? undefined,
          contentText: entry.contentText ?? undefined,
          isInbox: entry.isInbox,
          isStarred: entry.isStarred,
          isPinned: entry.isPinned
        })
        await entriesRepository.markSynced(entityId)
        break
      }
      case "tag": {
        const tag = data as Tag
        await tagsRepository.update(entityId, {
          name: tag.name,
          color: tag.color ?? undefined
        })
        await tagsRepository.markSynced(entityId)
        break
      }
      case "source": {
        const source = data as Source
        await sourcesRepository.update(entityId, {
          title: source.title,
          url: source.url ?? undefined,
          author: source.author ?? undefined
        })
        await sourcesRepository.markSynced(entityId)
        break
      }
      default: {
        console.warn(`Download not implemented for entity type: ${entityType}`)
      }
    }
  }

  /**
   * Perform full sync
   */
  async sync(
    localUserId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const {
      conflictStrategy = "local",
      incremental = true,
      onProgress
    } = options

    if (this._state === "syncing") {
      return {
        success: false,
        uploadedCount: 0,
        downloadedCount: 0,
        conflictCount: 0,
        errorCount: 1,
        errors: [
          {
            entityType: "entry",
            entityId: "",
            success: false,
            error: "Sync already in progress"
          }
        ],
        conflicts: [],
        duration: 0
      }
    }

    this.setState("syncing")

    const result: SyncResult = {
      success: true,
      uploadedCount: 0,
      downloadedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      errors: [],
      conflicts: [],
      duration: 0
    }

    try {
      const metadata = await loadSyncMetadata()
      const lastSyncAt = incremental ? metadata.lastSyncAt : null

      // Phase 1: Upload pending operations
      onProgress?.({
        phase: "uploading",
        current: 0,
        total: 0
      })

      const uploadResult = await this.uploadPendingOperations(
        localUserId,
        conflictStrategy,
        onProgress
      )
      result.uploadedCount = uploadResult.uploadedCount
      result.errors.push(...uploadResult.errors)
      result.conflicts.push(...uploadResult.conflicts)

      // Phase 2: Download new/updated items from server
      onProgress?.({
        phase: "downloading",
        current: 0,
        total: 0
      })

      const downloadResult = await this.downloadFromServer(
        localUserId,
        lastSyncAt,
        conflictStrategy,
        onProgress
      )
      result.downloadedCount = downloadResult.downloadedCount
      result.errors.push(...downloadResult.errors)
      result.conflicts.push(...downloadResult.conflicts)

      // Calculate final counts
      result.conflictCount = result.conflicts.length
      result.errorCount = result.errors.length
      result.success = result.errorCount === 0

      // Update metadata
      const lastSyncResult = this.determineSyncResult(result)
      await saveSyncMetadata({
        lastSyncAt: new Date(),
        lastSyncResult,
        pendingOperationsCount: await pendingOperations.getCount(),
        conflictsCount: result.conflictCount
      })

      // Save any new conflicts
      if (result.conflicts.length > 0) {
        const existingConflicts = await loadConflicts()
        await saveConflicts([...existingConflicts, ...result.conflicts])
      }

      this.setState(result.conflictCount > 0 ? "conflict" : "idle")
    } catch (error) {
      console.error("Sync failed:", error)
      result.success = false
      result.errorCount++
      result.errors.push({
        entityType: "entry",
        entityId: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      })
      this.setState("error")
    }

    result.duration = Date.now() - startTime

    onProgress?.({
      phase: "complete",
      current: result.uploadedCount + result.downloadedCount,
      total: result.uploadedCount + result.downloadedCount
    })

    return result
  }

  /**
   * Determine sync result status
   */
  private determineSyncResult(
    result: SyncResult
  ): "success" | "partial" | "failed" {
    if (result.success) {
      return "success"
    }
    if (result.errorCount > 0) {
      return "failed"
    }
    return "partial"
  }

  /**
   * Upload pending operations to server
   */
  private async uploadPendingOperations(
    localUserId: string,
    conflictStrategy: ConflictStrategy,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    uploadedCount: number
    errors: SyncEntityResult[]
    conflicts: SyncConflict[]
  }> {
    const operations = await pendingOperations.getAll()
    const errors: SyncEntityResult[] = []
    const conflicts: SyncConflict[] = []
    let uploadedCount = 0

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]

      onProgress?.({
        phase: "uploading",
        current: i + 1,
        total: operations.length,
        entityType: op.entityType
      })

      const result = await this.processOperation(
        op,
        localUserId,
        conflictStrategy,
        conflicts
      )

      if (result.success) {
        uploadedCount++
      } else if (result.error) {
        errors.push(result.error)
      }
    }

    return { uploadedCount, errors, conflicts }
  }

  /**
   * Process a single pending operation
   */
  private async processOperation(
    op: import("./types").PendingOperation,
    localUserId: string,
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<{ success: boolean; error?: SyncEntityResult }> {
    try {
      const payload = JSON.parse(op.payload)
      await this.syncEntityByType(
        op,
        localUserId,
        payload,
        conflictStrategy,
        conflicts
      )
      await pendingOperations.remove(op.id)
      return { success: true }
    } catch (error) {
      return this.handleOperationError(op, error, conflictStrategy, conflicts)
    }
  }

  /**
   * Sync entity based on type
   */
  private async syncEntityByType(
    op: import("./types").PendingOperation,
    localUserId: string,
    payload: unknown,
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<void> {
    switch (op.entityType) {
      case "entry": {
        await this.syncEntry(
          op.operation,
          payload as Entry,
          conflictStrategy,
          conflicts
        )
        break
      }
      case "tag": {
        await this.syncTag(op.operation, payload as Tag)
        break
      }
      case "source": {
        await this.syncSource(op.operation, payload as Source)
        break
      }
      case "reviewState":
      case "reviewEvent": {
        await this.syncReview(
          localUserId,
          op.entityId,
          payload as { rating?: string }
        )
        break
      }
      default: {
        console.warn(`Sync not implemented for: ${op.entityType}`)
      }
    }
  }

  /**
   * Handle operation error
   */
  private async handleOperationError(
    op: import("./types").PendingOperation,
    error: unknown,
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<{ success: boolean; error?: SyncEntityResult }> {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    const isConflict =
      errorMessage.includes("CONFLICT") || errorMessage.includes("conflict")

    if (isConflict) {
      return this.handleConflictError(
        op,
        errorMessage,
        conflictStrategy,
        conflicts
      )
    }

    await pendingOperations.markFailed(op.id, errorMessage)
    return {
      success: false,
      error: {
        entityType: op.entityType,
        entityId: op.entityId,
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Handle conflict error based on strategy
   */
  private async handleConflictError(
    op: import("./types").PendingOperation,
    errorMessage: string,
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<{ success: boolean; error?: SyncEntityResult }> {
    if (conflictStrategy === "local") {
      try {
        await this.forceUpload(op.entityType, JSON.parse(op.payload))
        await pendingOperations.remove(op.id)
        return { success: true }
      } catch {
        await pendingOperations.markFailed(op.id, errorMessage)
        return {
          success: false,
          error: {
            entityType: op.entityType,
            entityId: op.entityId,
            success: false,
            error: errorMessage,
            conflict: true
          }
        }
      }
    }

    if (conflictStrategy === "manual") {
      conflicts.push({
        id: generateConflictId(),
        entityType: op.entityType,
        entityId: op.entityId,
        localData: op.payload,
        remoteData: "{}",
        localUpdatedAt: op.createdAt,
        remoteUpdatedAt: new Date(),
        createdAt: new Date()
      })
    }

    return { success: false }
  }

  /**
   * Force upload an entity, overwriting server version
   */
  private async forceUpload(
    entityType: SyncConflict["entityType"],
    data: unknown
  ): Promise<void> {
    switch (entityType) {
      case "entry": {
        const entry = data as Entry
        // Delete and recreate to avoid version conflicts
        try {
          await client.entries.delete({ id: entry.id })
        } catch {
          // Ignore if not found
        }
        await client.entries.create({
          title: entry.title,
          contentJson: entry.contentJson ?? undefined,
          isInbox: entry.isInbox
        })
        break
      }
      // Add other entity types as needed
      default: {
        throw new Error(`Force upload not implemented for: ${entityType}`)
      }
    }
  }

  /**
   * Sync a single entry
   */
  private async syncEntry(
    operation: "create" | "update" | "delete",
    payload: Entry,
    _conflictStrategy: ConflictStrategy,
    _conflicts: SyncConflict[]
  ): Promise<void> {
    switch (operation) {
      case "create": {
        await client.entries.create({
          title: payload.title,
          contentJson: payload.contentJson ?? undefined,
          isInbox: payload.isInbox
        })
        break
      }
      case "update": {
        await client.entries.update({
          id: payload.id,
          title: payload.title,
          contentJson: payload.contentJson ?? undefined,
          isInbox: payload.isInbox,
          isStarred: payload.isStarred,
          isPinned: payload.isPinned,
          expectedVersion: payload.version
        })
        break
      }
      case "delete": {
        await client.entries.delete({ id: payload.id })
        break
      }
      default: {
        throw new Error(`Unknown entry operation: ${operation}`)
      }
    }
  }

  /**
   * Sync a single tag
   */
  private async syncTag(
    operation: "create" | "update" | "delete",
    payload: Tag
  ): Promise<void> {
    switch (operation) {
      case "create": {
        await client.tags.create({
          name: payload.name,
          color: payload.color ?? undefined
        })
        break
      }
      case "update": {
        await client.tags.update({
          id: payload.id,
          name: payload.name,
          color: payload.color ?? undefined
        })
        break
      }
      case "delete": {
        await client.tags.delete({ id: payload.id })
        break
      }
      default: {
        throw new Error(`Unknown tag operation: ${operation}`)
      }
    }
  }

  /**
   * Sync a single source
   */
  private async syncSource(
    operation: "create" | "update" | "delete",
    payload: Source
  ): Promise<void> {
    switch (operation) {
      case "create": {
        await client.sources.create({
          title: payload.title,
          type: payload.type as
            | "link"
            | "pdf"
            | "book"
            | "article"
            | "video"
            | "podcast"
            | "other",
          url: payload.url ?? undefined,
          author: payload.author ?? undefined
        })
        break
      }
      case "update": {
        await client.sources.update({
          id: payload.id,
          title: payload.title,
          url: payload.url ?? undefined,
          author: payload.author ?? undefined
        })
        break
      }
      case "delete": {
        await client.sources.delete({ id: payload.id })
        break
      }
      default: {
        throw new Error(`Unknown source operation: ${operation}`)
      }
    }
  }

  /**
   * Sync review data
   */
  private async syncReview(
    _localUserId: string,
    entryId: string,
    payload: { rating?: string }
  ): Promise<void> {
    // Review events are synced by marking as reviewed on server
    if (payload.rating) {
      await client.review.markReviewed({
        entryId,
        rating: payload.rating as "again" | "hard" | "good" | "easy",
        timeZone: getDeviceTimeZone()
      })
    }
  }

  /**
   * Download new/updated items from server
   */
  private async downloadFromServer(
    localUserId: string,
    _lastSyncAt: Date | null,
    conflictStrategy: ConflictStrategy,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    downloadedCount: number
    errors: SyncEntityResult[]
    conflicts: SyncConflict[]
  }> {
    const errors: SyncEntityResult[] = []
    const conflicts: SyncConflict[] = []
    let downloadedCount = 0

    try {
      onProgress?.({
        phase: "downloading",
        current: 0,
        total: 1,
        entityType: "entry"
      })

      // Download entries
      const entriesResult = await this.downloadEntries(
        localUserId,
        conflictStrategy,
        conflicts
      )
      downloadedCount += entriesResult.downloadedCount
      errors.push(...entriesResult.errors)

      // Download tags
      const tagsResult = await this.downloadTags(localUserId)
      downloadedCount += tagsResult.downloadedCount
      errors.push(...tagsResult.errors)

      // Download sources
      const sourcesResult = await this.downloadSources(localUserId)
      downloadedCount += sourcesResult.downloadedCount
      errors.push(...sourcesResult.errors)
    } catch (error) {
      errors.push({
        entityType: "entry",
        entityId: "",
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to download from server"
      })
    }

    return { downloadedCount, errors, conflicts }
  }

  /**
   * Download entries from server
   */
  private async downloadEntries(
    localUserId: string,
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<{ downloadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let downloadedCount = 0

    const serverEntries = await client.entries.list({
      filter: "all",
      limit: 100
    })

    for (const serverEntry of serverEntries.items) {
      try {
        const result = await this.processServerEntry(
          localUserId,
          serverEntry,
          conflictStrategy,
          conflicts
        )
        if (result) {
          downloadedCount++
        }
      } catch (error) {
        errors.push({
          entityType: "entry",
          entityId: serverEntry.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { downloadedCount, errors }
  }

  /**
   * Process a single server entry
   */
  private async processServerEntry(
    localUserId: string,
    serverEntry: {
      id: string
      title: string
      contentJson?: string | null
      contentText?: string | null
      isInbox: boolean
      isStarred: boolean
      isPinned: boolean
      createdAt: Date | string
      updatedAt: Date | string
      version: string
    },
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<boolean> {
    const localEntry = await entriesRepository.findById(serverEntry.id)

    if (!localEntry) {
      await this.createLocalEntry(localUserId, serverEntry)
      return true
    }

    if (localEntry.syncStatus === "synced") {
      await this.updateLocalEntry(serverEntry)
      return true
    }

    if (localEntry.syncStatus === "pending") {
      return this.handleEntryConflict(
        localEntry,
        serverEntry,
        conflictStrategy,
        conflicts
      )
    }

    return false
  }

  /**
   * Handle entry conflict
   */
  private async handleEntryConflict(
    localEntry: Entry,
    serverEntry: {
      id: string
      title: string
      contentJson?: string | null
      contentText?: string | null
      isInbox: boolean
      isStarred: boolean
      isPinned: boolean
      updatedAt: Date | string
    },
    conflictStrategy: ConflictStrategy,
    conflicts: SyncConflict[]
  ): Promise<boolean> {
    const serverUpdatedAt = new Date(serverEntry.updatedAt)
    const localUpdatedAt = localEntry.updatedAt

    if (serverUpdatedAt <= localUpdatedAt) {
      return false
    }

    if (conflictStrategy === "remote") {
      await this.updateLocalEntry(serverEntry)
      return true
    }

    if (conflictStrategy === "manual") {
      conflicts.push({
        id: generateConflictId(),
        entityType: "entry",
        entityId: serverEntry.id,
        localData: JSON.stringify(localEntry),
        remoteData: JSON.stringify(serverEntry),
        localUpdatedAt,
        remoteUpdatedAt: serverUpdatedAt,
        createdAt: new Date()
      })
    }

    return false
  }

  /**
   * Download tags from server
   */
  private async downloadTags(
    localUserId: string
  ): Promise<{ downloadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let downloadedCount = 0

    const serverTags = await client.tags.list()

    for (const serverTag of serverTags) {
      try {
        const localTag = await tagsRepository.findById(serverTag.id)
        if (!localTag) {
          await this.createLocalTag(localUserId, serverTag)
          downloadedCount++
        } else if (localTag.syncStatus === "synced") {
          await this.updateLocalTag(serverTag)
          downloadedCount++
        }
      } catch (error) {
        errors.push({
          entityType: "tag",
          entityId: serverTag.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { downloadedCount, errors }
  }

  /**
   * Download sources from server
   */
  private async downloadSources(
    localUserId: string
  ): Promise<{ downloadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let downloadedCount = 0

    const serverSources = await client.sources.list({ limit: 100 })

    for (const serverSource of serverSources.items) {
      try {
        const localSource = await sourcesRepository.findById(serverSource.id)
        if (!localSource) {
          await this.createLocalSource(localUserId, serverSource)
          downloadedCount++
        } else if (localSource.syncStatus === "synced") {
          await this.updateLocalSource(serverSource)
          downloadedCount++
        }
      } catch (error) {
        errors.push({
          entityType: "source",
          entityId: serverSource.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { downloadedCount, errors }
  }

  /**
   * Create a local entry from server data
   */
  private async createLocalEntry(
    userId: string,
    serverEntry: {
      id: string
      title: string
      contentJson?: string | null
      contentText?: string | null
      isInbox: boolean
      isStarred: boolean
      isPinned: boolean
      createdAt: Date | string
      updatedAt: Date | string
      version: string
    }
  ): Promise<void> {
    // Use repository's internal create that accepts ID
    await entriesRepository.create({
      userId,
      title: serverEntry.title,
      contentJson: serverEntry.contentJson ?? undefined,
      contentText: serverEntry.contentText ?? undefined,
      isInbox: serverEntry.isInbox,
      isStarred: serverEntry.isStarred,
      isPinned: serverEntry.isPinned
    })
    await entriesRepository.markSynced(serverEntry.id)
  }

  /**
   * Update a local entry from server data
   */
  private async updateLocalEntry(serverEntry: {
    id: string
    title: string
    contentJson?: string | null
    contentText?: string | null
    isInbox: boolean
    isStarred: boolean
    isPinned: boolean
  }): Promise<void> {
    await entriesRepository.update(serverEntry.id, {
      title: serverEntry.title,
      contentJson: serverEntry.contentJson ?? undefined,
      contentText: serverEntry.contentText ?? undefined,
      isInbox: serverEntry.isInbox,
      isStarred: serverEntry.isStarred,
      isPinned: serverEntry.isPinned
    })
    await entriesRepository.markSynced(serverEntry.id)
  }

  /**
   * Create a local tag from server data
   */
  private async createLocalTag(
    userId: string,
    serverTag: {
      id: string
      name: string
      color?: string | null
    }
  ): Promise<void> {
    await tagsRepository.create({
      userId,
      name: serverTag.name,
      color: serverTag.color ?? undefined
    })
    await tagsRepository.markSynced(serverTag.id)
  }

  /**
   * Update a local tag from server data
   */
  private async updateLocalTag(serverTag: {
    id: string
    name: string
    color?: string | null
  }): Promise<void> {
    await tagsRepository.update(serverTag.id, {
      name: serverTag.name,
      color: serverTag.color ?? undefined
    })
    await tagsRepository.markSynced(serverTag.id)
  }

  /**
   * Create a local source from server data
   */
  private async createLocalSource(
    userId: string,
    serverSource: {
      id: string
      title: string
      type: string
      url?: string | null
      author?: string | null
    }
  ): Promise<void> {
    await sourcesRepository.create({
      userId,
      title: serverSource.title,
      type: serverSource.type as
        | "link"
        | "pdf"
        | "book"
        | "article"
        | "video"
        | "podcast"
        | "other",
      url: serverSource.url ?? undefined,
      author: serverSource.author ?? undefined
    })
    await sourcesRepository.markSynced(serverSource.id)
  }

  /**
   * Update a local source from server data
   */
  private async updateLocalSource(serverSource: {
    id: string
    title: string
    url?: string | null
    author?: string | null
  }): Promise<void> {
    await sourcesRepository.update(serverSource.id, {
      title: serverSource.title,
      url: serverSource.url ?? undefined,
      author: serverSource.author ?? undefined
    })
    await sourcesRepository.markSynced(serverSource.id)
  }

  /**
   * Upload all local data to server (for first sync after login)
   */
  async uploadAllLocalData(localUserId: string): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      uploadedCount: 0,
      downloadedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      errors: [],
      conflicts: [],
      duration: 0
    }

    this.setState("syncing")

    try {
      // Upload entries
      const entriesResult = await this.uploadPendingEntries(localUserId)
      result.uploadedCount += entriesResult.uploadedCount
      result.errors.push(...entriesResult.errors)

      // Upload tags
      const tagsResult = await this.uploadPendingTags(localUserId)
      result.uploadedCount += tagsResult.uploadedCount
      result.errors.push(...tagsResult.errors)

      // Upload sources
      const sourcesResult = await this.uploadPendingSources(localUserId)
      result.uploadedCount += sourcesResult.uploadedCount
      result.errors.push(...sourcesResult.errors)

      // Upload review states
      const reviewResult = await this.uploadPendingReviewStates(localUserId)
      result.uploadedCount += reviewResult.uploadedCount
      result.errors.push(...reviewResult.errors)

      result.errorCount = result.errors.length
      result.success = result.errorCount === 0

      await saveSyncMetadata({
        lastSyncAt: new Date(),
        lastSyncResult: result.success ? "success" : "partial",
        pendingOperationsCount: 0,
        conflictsCount: 0
      })

      this.setState("idle")
    } catch (error) {
      result.success = false
      result.errorCount++
      result.errors.push({
        entityType: "entry",
        entityId: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      })
      this.setState("error")
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * Upload pending entries
   */
  private async uploadPendingEntries(
    localUserId: string
  ): Promise<{ uploadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let uploadedCount = 0

    const pendingEntries = await entriesRepository.getPendingSync(localUserId)

    for (const entry of pendingEntries) {
      try {
        await client.entries.create({
          title: entry.title,
          contentJson: entry.contentJson ?? undefined,
          isInbox: entry.isInbox
        })
        await entriesRepository.markSynced(entry.id)
        uploadedCount++
      } catch (error) {
        errors.push({
          entityType: "entry",
          entityId: entry.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { uploadedCount, errors }
  }

  /**
   * Upload pending tags
   */
  private async uploadPendingTags(
    localUserId: string
  ): Promise<{ uploadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let uploadedCount = 0

    const pendingTags = await tagsRepository.getPendingSync(localUserId)

    for (const tag of pendingTags) {
      try {
        await client.tags.create({
          name: tag.name,
          color: tag.color ?? undefined
        })
        await tagsRepository.markSynced(tag.id)
        uploadedCount++
      } catch (error) {
        errors.push({
          entityType: "tag",
          entityId: tag.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { uploadedCount, errors }
  }

  /**
   * Upload pending sources
   */
  private async uploadPendingSources(
    localUserId: string
  ): Promise<{ uploadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let uploadedCount = 0

    const pendingSources = await sourcesRepository.getPendingSync(localUserId)

    for (const source of pendingSources) {
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
        uploadedCount++
      } catch (error) {
        errors.push({
          entityType: "source",
          entityId: source.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { uploadedCount, errors }
  }

  /**
   * Upload pending review states
   */
  private async uploadPendingReviewStates(
    localUserId: string
  ): Promise<{ uploadedCount: number; errors: SyncEntityResult[] }> {
    const errors: SyncEntityResult[] = []
    let uploadedCount = 0

    const pendingReviewStates =
      await reviewRepository.getPendingSyncStates(localUserId)

    for (const state of pendingReviewStates) {
      try {
        await client.review.markReviewed({
          entryId: state.entryId,
          rating: "good",
          timeZone: getDeviceTimeZone()
        })
        await reviewRepository.markStateSynced(state.entryId)
        uploadedCount++
      } catch (error) {
        errors.push({
          entityType: "reviewState",
          entityId: state.entryId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { uploadedCount, errors }
  }
}

// Export singleton instance
export const syncService = new SyncService()
