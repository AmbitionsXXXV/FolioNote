import { db, entries, entryColumns, entryShares } from "@folionote/db"
import { ORPCError } from "@orpc/server"
import bcrypt from "bcryptjs"
import { and, eq, isNull, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { protectedProcedure, publicProcedure } from "../index"

const BCRYPT_ROUNDS = 10

/**
 * Input schema for creating a share link
 */
const CreateShareInputSchema = z.object({
  entryId: z.string(),
  /** Password for protected share (optional) */
  password: z.string().min(4).optional(),
  /** Expiration time (optional, null = never expires) */
  expiresAt: z.string().datetime().optional(),
  /** Whether to show FolioNote branding */
  showBranding: z.boolean().optional().default(true)
})

/**
 * Input schema for updating a share
 */
const UpdateShareInputSchema = z.object({
  id: z.string(),
  /** New password (optional, set to empty string to remove) */
  password: z.string().optional(),
  /** New expiration time (optional) */
  expiresAt: z.string().datetime().nullable().optional(),
  /** Whether to show branding */
  showBranding: z.boolean().optional(),
  /** Whether the share is active */
  isActive: z.boolean().optional()
})

/**
 * Input schema for getting shares by entry
 */
const GetSharesByEntryInputSchema = z.object({
  entryId: z.string()
})

/**
 * Input schema for deleting a share
 */
const DeleteShareInputSchema = z.object({
  id: z.string()
})

/**
 * Input schema for getting public entry
 */
const GetPublicEntryInputSchema = z.object({
  shareToken: z.string(),
  /** Password if the share is protected */
  password: z.string().optional()
})

/**
 * shares.create - Create a new share link for an entry
 */
export const createShare = protectedProcedure
  .input(CreateShareInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { entryId, password, expiresAt, showBranding } = input

    // Verify the entry belongs to the user and is not deleted
    const [entry] = await db
      .select(entryColumns)
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

    // Generate unique share token
    const shareToken = nanoid(21)

    // Hash password if provided
    let passwordHash: string | null = null
    if (password) {
      passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    }

    const id = nanoid()
    const result = await db
      .insert(entryShares)
      .values({
        id,
        entryId,
        userId,
        shareToken,
        passwordHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        showBranding
      })
      .returning()

    const share = result[0]
    if (!share) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create share"
      })
    }

    return {
      id: share.id,
      shareToken: share.shareToken,
      hasPassword: !!share.passwordHash,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      showBranding: share.showBranding,
      isActive: share.isActive,
      viewCount: share.viewCount,
      createdAt: share.createdAt.toISOString()
    }
  })

/**
 * shares.get - Get all shares for an entry
 */
export const getSharesByEntry = protectedProcedure
  .input(GetSharesByEntryInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { entryId } = input

    // Verify the entry belongs to the user
    const [entry] = await db
      .select(entryColumns)
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

    const shares = await db
      .select()
      .from(entryShares)
      .where(eq(entryShares.entryId, entryId))

    return shares.map((share) => ({
      id: share.id,
      shareToken: share.shareToken,
      hasPassword: !!share.passwordHash,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      showBranding: share.showBranding,
      isActive: share.isActive,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString()
    }))
  })

/**
 * shares.update - Update a share configuration
 */
export const updateShare = protectedProcedure
  .input(UpdateShareInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id, password, expiresAt, showBranding, isActive } = input

    // Verify the share belongs to the user
    const [existingShare] = await db
      .select()
      .from(entryShares)
      .where(and(eq(entryShares.id, id), eq(entryShares.userId, userId)))
      .limit(1)

    if (!existingShare) {
      throw new ORPCError("NOT_FOUND", { message: "Share not found" })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (password !== undefined) {
      if (password === "") {
        // Remove password protection
        updateData.passwordHash = null
      } else if (password.length >= 4) {
        // Set new password
        updateData.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
      }
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    }

    if (showBranding !== undefined) {
      updateData.showBranding = showBranding
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    const result = await db
      .update(entryShares)
      .set(updateData)
      .where(eq(entryShares.id, id))
      .returning()

    const share = result[0]
    if (!share) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update share"
      })
    }

    return {
      id: share.id,
      shareToken: share.shareToken,
      hasPassword: !!share.passwordHash,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      showBranding: share.showBranding,
      isActive: share.isActive,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString()
    }
  })

/**
 * shares.delete - Delete a share link
 */
export const deleteShare = protectedProcedure
  .input(DeleteShareInputSchema)
  .handler(async ({ context, input }) => {
    const userId = context.session.user.id
    const { id } = input

    const result = await db
      .delete(entryShares)
      .where(and(eq(entryShares.id, id), eq(entryShares.userId, userId)))
      .returning()

    if (result.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Share not found" })
    }

    return { success: true }
  })

/**
 * shares.getPublicEntry - Get shared entry content (public, no auth required)
 *
 * This is the endpoint accessed when viewing a shared link.
 * It validates the share token, checks expiration and password,
 * and returns the entry content if valid.
 */
export const getPublicEntry = publicProcedure
  .input(GetPublicEntryInputSchema)
  .handler(async ({ input }) => {
    const { shareToken, password } = input

    // Find the share by token
    const [share] = await db
      .select()
      .from(entryShares)
      .where(eq(entryShares.shareToken, shareToken))
      .limit(1)

    if (!share) {
      throw new ORPCError("NOT_FOUND", { message: "Share link not found" })
    }

    // Check if share is active
    if (!share.isActive) {
      throw new ORPCError("FORBIDDEN", {
        message: "This share link has been disabled"
      })
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ORPCError("FORBIDDEN", {
        message: "This share link has expired"
      })
    }

    // Check password if required
    if (share.passwordHash) {
      if (!password) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Password required",
          data: { requiresPassword: true }
        })
      }

      const isValidPassword = await bcrypt.compare(password, share.passwordHash)
      if (!isValidPassword) {
        throw new ORPCError("UNAUTHORIZED", { message: "Invalid password" })
      }
    }

    // Get the entry
    const [entry] = await db
      .select(entryColumns)
      .from(entries)
      .where(and(eq(entries.id, share.entryId), isNull(entries.deletedAt)))
      .limit(1)

    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Entry not found" })
    }

    // Update view count and last viewed time
    await db
      .update(entryShares)
      .set({
        viewCount: sql`${entryShares.viewCount} + 1`,
        lastViewedAt: new Date()
      })
      .where(eq(entryShares.id, share.id))

    return {
      entry: {
        id: entry.id,
        title: entry.title,
        contentJson: entry.contentJson,
        contentText: entry.contentText,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
      },
      share: {
        showBranding: share.showBranding
      }
    }
  })

/**
 * shares.checkPassword - Check if a share requires password (public, no auth required)
 */
export const checkShareRequiresPassword = publicProcedure
  .input(z.object({ shareToken: z.string() }))
  .handler(async ({ input }) => {
    const { shareToken } = input

    const [share] = await db
      .select({
        hasPassword: entryShares.passwordHash,
        isActive: entryShares.isActive,
        expiresAt: entryShares.expiresAt
      })
      .from(entryShares)
      .where(eq(entryShares.shareToken, shareToken))
      .limit(1)

    if (!share) {
      throw new ORPCError("NOT_FOUND", { message: "Share link not found" })
    }

    // Check if share is active
    if (!share.isActive) {
      throw new ORPCError("FORBIDDEN", {
        message: "This share link has been disabled"
      })
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ORPCError("FORBIDDEN", {
        message: "This share link has expired"
      })
    }

    return {
      requiresPassword: !!share.hasPassword
    }
  })

/**
 * Shares router - all share-related procedures
 */
export const sharesRouter = {
  create: createShare,
  getByEntry: getSharesByEntry,
  update: updateShare,
  delete: deleteShare,
  getPublicEntry,
  checkRequiresPassword: checkShareRequiresPassword
}
