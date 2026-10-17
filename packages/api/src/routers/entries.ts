import { db, entries, entryCollaborators, entryTags, tags } from "@folionote/db"
import { ORPCError } from "@orpc/server"
import bcrypt from "bcryptjs"
import { and, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { protectedProcedure } from "../index"
import { processContentUpdate } from "../utils/content"
import { getEntryAccessRole } from "../utils/entry-access"
import { extractEntryRefs, syncEntryLinks } from "../utils/link-sync"

const BCRYPT_ROUNDS = 10

type ContentChangeListener = (entryId: string, userId: string) => void
let onContentChange: ContentChangeListener | undefined

/**
 * Register a callback invoked after entry content is created or updated.
 * Used by the server to trigger async embedding indexing.
 */
export function setContentChangeListener(listener: ContentChangeListener) {
  onContentChange = listener
}

/** For content written outside this router (imports), so it gets indexed too. */
export function notifyEntryContentChanged(entryId: string, userId: string) {
  onContentChange?.(entryId, userId)
}

/**
 * Entry filter types for list queries
 */
const EntryFilterSchema = z
  .enum(["inbox", "starred", "pinned", "deleted", "all"])
  .default("all")

/**
 * Input schema for creating an entry
 *
 * 内容格式：
 * - contentJson: ProseMirror JSON（用于富文本编辑器）
 */
const CreateEntryInputSchema = z.object({
  title: z.string().optional().default(""),
  /** ProseMirror JSON 格式内容 */
  contentJson: z.string().optional(),
  isInbox: z.boolean().optional().default(true)
})

/**
 * Input schema for updating an entry
 *
 * 内容格式：
 * - contentJson: ProseMirror JSON（用于富文本编辑器）
 *
 * 乐观锁：
 * - expectedVersion: 期望的版本号，用于并发控制
 */
const UpdateEntryInputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  /** ProseMirror JSON 格式内容 */
  contentJson: z.string().optional(),
  isInbox: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  /** 期望的版本号，用于乐观锁并发控制 */
  expectedVersion: z.string().optional()
})

/**
 * Input schema for getting a single entry
 */
const GetEntryInputSchema = z.object({
  id: z.string()
})

/**
 * Input schema for listing entries with pagination
 */
const ListEntriesInputSchema = z.object({
  filter: EntryFilterSchema,
  tagId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20)
})

/**
 * Input schema for adding/removing tags from entries
 */
const EntryTagInputSchema = z.object({
  entryId: z.string(),
  tagId: z.string()
})

/**
 * entries.create - Create a new entry
 *
 * 使用 contentJson，自动派生 contentText 用于搜索
 */
export const createEntry = protectedProcedure
  .input(CreateEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const id = nanoid()

    // 处理内容
    let contentJson: string | null = null
    let contentText: string | null = null

    if (input.contentJson) {
      const processed = processContentUpdate(input.contentJson)
      contentJson = processed.contentJson
      contentText = processed.contentText
    }

    const [entry] = await db
      .insert(entries)
      .values({
        id,
        userId,
        title: input.title,
        contentJson,
        contentText,
        isInbox: input.isInbox
      })
      .returning()

    if (contentJson) {
      const refIds = extractEntryRefs(contentJson)
      if (refIds.length > 0) {
        await syncEntryLinks(userId, id, refIds)
      }
    }

    if (contentText) {
      onContentChange?.(id, userId)
    }

    return entry
  })

/**
 * entries.update - Update an existing entry
 *
 * 使用 contentJson，自动派生 contentText 用于搜索
 *
 * 乐观锁：如果提供 expectedVersion，则只有版本匹配时才更新
 */
export const updateEntry = protectedProcedure
  .input(UpdateEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id, expectedVersion, ...updateData } = input

    // Only include defined fields in the update
    const fieldsToUpdate: Record<string, unknown> = {}
    if (updateData.title !== undefined) {
      fieldsToUpdate.title = updateData.title
    }

    // 处理内容更新
    if (updateData.contentJson !== undefined) {
      const processed = processContentUpdate(updateData.contentJson)
      fieldsToUpdate.contentJson = processed.contentJson
      fieldsToUpdate.contentText = processed.contentText
    }

    if (updateData.isInbox !== undefined) {
      fieldsToUpdate.isInbox = updateData.isInbox
    }
    if (updateData.isStarred !== undefined) {
      fieldsToUpdate.isStarred = updateData.isStarred
    }
    if (updateData.isPinned !== undefined) {
      fieldsToUpdate.isPinned = updateData.isPinned
    }

    // 构建更新条件
    const conditions = [
      eq(entries.id, id),
      eq(entries.userId, userId),
      isNull(entries.deletedAt)
    ]

    // 乐观锁：如果提供了期望版本，添加版本检查条件
    if (expectedVersion !== undefined) {
      conditions.push(eq(entries.version, expectedVersion))
      // 更新版本号
      const newVersion = String(Number(expectedVersion) + 1)
      fieldsToUpdate.version = newVersion
    }

    const [entry] = await db
      .update(entries)
      .set(fieldsToUpdate)
      .where(and(...conditions))
      .returning()

    if (entry && updateData.contentJson !== undefined) {
      const refIds = extractEntryRefs(updateData.contentJson)
      await syncEntryLinks(userId, id, refIds)
      onContentChange?.(id, userId)
    }

    if (!entry) {
      // 检查是否因为版本冲突导致更新失败
      if (expectedVersion !== undefined) {
        const [existingEntry] = await db
          .select()
          .from(entries)
          .where(
            and(
              eq(entries.id, id),
              eq(entries.userId, userId),
              isNull(entries.deletedAt)
            )
          )
          .limit(1)

        if (existingEntry) {
          throw new ORPCError("CONFLICT", {
            message:
              "Version conflict: entry has been modified by another client",
            data: {
              currentVersion: existingEntry.version,
              expectedVersion
            }
          })
        }
      }
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    return entry
  })

/**
 * entries.delete - Soft delete an entry
 */
export const deleteEntry = protectedProcedure
  .input(GetEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id

    const [entry] = await db
      .update(entries)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(entries.id, input.id),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .returning()

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    return { success: true }
  })

/**
 * entries.restore - Restore a soft-deleted entry
 */
export const restoreEntry = protectedProcedure
  .input(GetEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id

    const [entry] = await db
      .update(entries)
      .set({ deletedAt: null })
      .where(
        and(
          eq(entries.id, input.id),
          eq(entries.userId, userId),
          isNotNull(entries.deletedAt)
        )
      )
      .returning()

    if (!entry) {
      throw new ORPCError("NOT_FOUND", {
        message: "Entry not found or not deleted"
      })
    }

    return entry
  })

/**
 * entries.get - Get a single entry by ID
 *
 * Available to the owner or any invited collaborator (see
 * `getEntryAccessRole` — password-locked entries deny collaborators
 * entirely). `update`/`delete`/tags/sources stay owner-only: collaborators
 * change body content exclusively through the collab socket.
 */
export const getEntry = protectedProcedure
  .input(GetEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id

    const accessRole = await getEntryAccessRole(userId, input.id)
    if (!accessRole) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    const [entry] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.id, input.id), isNull(entries.deletedAt)))
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Whether *this entry* has any collaborators at all — not whether
    // *this caller* is one. The owner needs this too: once a first
    // collaborator is invited, the owner's own client must also switch to
    // the Yjs-backed editor, or they'd never actually sync with each other.
    const [collaboratorRow] = await db
      .select({ id: entryCollaborators.id })
      .from(entryCollaborators)
      .where(eq(entryCollaborators.entryId, input.id))
      .limit(1)

    return {
      ...entry,
      accessRole,
      isCollaborative: Boolean(collaboratorRow)
    }
  })

/**
 * entries.list - List entries with filtering and cursor-based pagination
 */
export const listEntries = protectedProcedure
  .input(ListEntriesInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { filter, tagId, cursor, limit } = input

    // Build filter conditions based on filter type
    const conditions = [eq(entries.userId, userId)]

    switch (filter) {
      case "inbox": {
        conditions.push(eq(entries.isInbox, true), isNull(entries.deletedAt))
        break
      }
      case "starred": {
        conditions.push(eq(entries.isStarred, true), isNull(entries.deletedAt))
        break
      }
      case "pinned": {
        conditions.push(eq(entries.isPinned, true), isNull(entries.deletedAt))
        break
      }
      case "deleted": {
        conditions.push(isNotNull(entries.deletedAt))
        break
      }
      default: {
        conditions.push(isNull(entries.deletedAt))
        break
      }
    }

    // Filter by tag if tagId is provided
    if (tagId) {
      // First verify the tag belongs to the user
      const [tag] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
        .limit(1)

      if (!tag) {
        throw new ORPCError("NOT_FOUND", { message: "Tag not found" })
      }

      // Get entry IDs that have this tag
      const taggedEntries = await db
        .select({ entryId: entryTags.entryId })
        .from(entryTags)
        .where(eq(entryTags.tagId, tagId))

      const entryIds = taggedEntries.map((et) => et.entryId)

      if (entryIds.length === 0) {
        return { items: [], nextCursor: undefined, hasMore: false }
      }

      conditions.push(inArray(entries.id, entryIds))
    }

    // Add cursor condition for pagination
    if (cursor) {
      // Cursor is the ID of the last item from the previous page
      // We need to find entries created before the cursor entry
      const [cursorEntry] = await db
        .select({ updatedAt: entries.updatedAt })
        .from(entries)
        .where(eq(entries.id, cursor))
        .limit(1)

      if (cursorEntry) {
        conditions.push(lt(entries.updatedAt, cursorEntry.updatedAt))
      }
    }

    const items = await db
      .select()
      .from(entries)
      .where(and(...conditions))
      .orderBy(desc(entries.updatedAt))
      .limit(limit + 1) // Fetch one extra to determine if there are more

    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? resultItems.at(-1)?.id : undefined

    return {
      items: resultItems,
      nextCursor,
      hasMore
    }
  })

/**
 * entries.addTag - Add a tag to an entry
 */
export const addTagToEntry = protectedProcedure
  .input(EntryTagInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { entryId, tagId } = input

    // Verify the entry belongs to the user and is not deleted
    const [entry] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, entryId),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Verify the tag belongs to the user
    const [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .limit(1)

    if (!tag) {
      throw new ORPCError("NOT_FOUND", { message: "Tag not found" })
    }

    // Check if the association already exists
    const [existingAssociation] = await db
      .select()
      .from(entryTags)
      .where(and(eq(entryTags.entryId, entryId), eq(entryTags.tagId, tagId)))
      .limit(1)

    if (existingAssociation) {
      // Already exists, return success
      return { success: true, entryTag: existingAssociation }
    }

    // Create the association
    const [entryTag] = await db
      .insert(entryTags)
      .values({
        id: nanoid(),
        entryId,
        tagId
      })
      .returning()

    return { success: true, entryTag }
  })

/**
 * entries.removeTag - Remove a tag from an entry
 */
export const removeTagFromEntry = protectedProcedure
  .input(EntryTagInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { entryId, tagId } = input

    // Verify the entry belongs to the user
    const [entry] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, entryId),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Delete the association
    const result = await db
      .delete(entryTags)
      .where(and(eq(entryTags.entryId, entryId), eq(entryTags.tagId, tagId)))
      .returning()

    return { success: true, deleted: result.length > 0 }
  })

/**
 * entries.getTags - Get all tags for an entry
 */
export const getEntryTags = protectedProcedure
  .input(GetEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id

    // Verify the entry belongs to the user
    const [entry] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, input.id),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Get all tags for this entry
    const associations = await db
      .select({
        tag: tags
      })
      .from(entryTags)
      .innerJoin(tags, eq(entryTags.tagId, tags.id))
      .where(eq(entryTags.entryId, input.id))

    return associations.map((a) => a.tag)
  })

/**
 * Input schema for setting entry password
 */
const SetEntryPasswordInputSchema = z.object({
  id: z.string(),
  password: z.string().min(4)
})

/**
 * Input schema for removing entry password
 */
const RemoveEntryPasswordInputSchema = z.object({
  id: z.string()
})

/**
 * Input schema for verifying entry password
 */
const VerifyEntryPasswordInputSchema = z.object({
  id: z.string(),
  password: z.string()
})

/**
 * entries.setPassword - Set or update password protection for an entry
 */
export const setEntryPassword = protectedProcedure
  .input(SetEntryPasswordInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id, password } = input

    // Verify the entry belongs to the user
    const [entry] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, id),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Update the entry with password hash
    const [updatedEntry] = await db
      .update(entries)
      .set({ passwordHash })
      .where(eq(entries.id, id))
      .returning()

    if (!updatedEntry) {
      throw new ORPCError("NOT_FOUND", { message: "Failed to update entry" })
    }

    return {
      id: updatedEntry.id,
      hasPassword: true
    }
  })

/**
 * entries.removePassword - Remove password protection from an entry
 */
export const removeEntryPassword = protectedProcedure
  .input(RemoveEntryPasswordInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id } = input

    // Verify the entry belongs to the user
    const [entry] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, id),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Remove the password hash
    const [updatedEntry] = await db
      .update(entries)
      .set({ passwordHash: null })
      .where(eq(entries.id, id))
      .returning()

    if (!updatedEntry) {
      throw new ORPCError("NOT_FOUND", { message: "Failed to update entry" })
    }

    return {
      id: updatedEntry.id,
      hasPassword: false
    }
  })

/**
 * entries.verifyPassword - Verify password for a protected entry
 */
export const verifyEntryPassword = protectedProcedure
  .input(VerifyEntryPasswordInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id, password } = input

    // Get the entry
    const [entry] = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, id),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // If no password is set, return success
    if (!entry.passwordHash) {
      return { valid: true, hasPassword: false }
    }

    // Verify the password
    const isValid = await bcrypt.compare(password, entry.passwordHash)

    if (!isValid) {
      throw new ORPCError("UNAUTHORIZED", { message: "Invalid password" })
    }

    return { valid: true, hasPassword: true }
  })

/**
 * entries.checkPassword - Check if an entry has password protection
 */
export const checkEntryPassword = protectedProcedure
  .input(GetEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id

    const [entry] = await db
      .select({ passwordHash: entries.passwordHash })
      .from(entries)
      .where(
        and(
          eq(entries.id, input.id),
          eq(entries.userId, userId),
          isNull(entries.deletedAt)
        )
      )
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    return { hasPassword: !!entry.passwordHash }
  })

/**
 * Entries router - all entry-related procedures
 */
export const entriesRouter = {
  create: createEntry,
  update: updateEntry,
  delete: deleteEntry,
  restore: restoreEntry,
  get: getEntry,
  list: listEntries,
  addTag: addTagToEntry,
  removeTag: removeTagFromEntry,
  getTags: getEntryTags,
  // Password protection
  setPassword: setEntryPassword,
  removePassword: removeEntryPassword,
  verifyPassword: verifyEntryPassword,
  checkPassword: checkEntryPassword
}
