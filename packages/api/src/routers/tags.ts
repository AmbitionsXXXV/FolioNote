import { db, entryTags, tags } from '@folio/db'
import { ORPCError } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { protectedProcedure } from '../index'

/**
 * Input schema for creating a tag
 */
const CreateTagInputSchema = z.object({
	name: z.string().min(1).max(50),
	color: z.string().optional(),
})

/**
 * Input schema for updating a tag
 */
const UpdateTagInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(50).optional(),
	color: z.string().nullable().optional(),
})

/**
 * Input schema for getting/deleting a single tag
 */
const GetTagInputSchema = z.object({
	id: z.string(),
})

/**
 * tags.create - Create a new tag
 */
export const createTag = protectedProcedure
	.input(CreateTagInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const id = nanoid()

		// Check if tag with same name already exists for this user
		const [existingTag] = await db
			.select()
			.from(tags)
			.where(and(eq(tags.userId, userId), eq(tags.name, input.name)))
			.limit(1)

		if (existingTag) {
			throw new ORPCError('CONFLICT', {
				message: 'Tag with this name already exists',
			})
		}

		const [tag] = await db
			.insert(tags)
			.values({
				id,
				userId,
				name: input.name,
				color: input.color ?? null,
			})
			.returning()

		return tag
	})

/**
 * tags.update - Update an existing tag
 */
export const updateTag = protectedProcedure
	.input(UpdateTagInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { id, ...updateData } = input

		// Only include defined fields in the update
		const fieldsToUpdate: Record<string, unknown> = {}
		if (updateData.name !== undefined) {
			// Check if another tag with same name already exists
			const [existingTag] = await db
				.select()
				.from(tags)
				.where(and(eq(tags.userId, userId), eq(tags.name, updateData.name)))
				.limit(1)

			if (existingTag && existingTag.id !== id) {
				throw new ORPCError('CONFLICT', {
					message: 'Tag with this name already exists',
				})
			}
			fieldsToUpdate.name = updateData.name
		}
		if (updateData.color !== undefined) {
			fieldsToUpdate.color = updateData.color
		}

		if (Object.keys(fieldsToUpdate).length === 0) {
			// No fields to update, just return the existing tag
			const [existingTag] = await db
				.select()
				.from(tags)
				.where(and(eq(tags.id, id), eq(tags.userId, userId)))
				.limit(1)

			if (!existingTag) {
				throw new ORPCError('NOT_FOUND', { message: 'Tag not found' })
			}
			return existingTag
		}

		const [tag] = await db
			.update(tags)
			.set(fieldsToUpdate)
			.where(and(eq(tags.id, id), eq(tags.userId, userId)))
			.returning()

		if (!tag) {
			throw new ORPCError('NOT_FOUND', { message: 'Tag not found' })
		}

		return tag
	})

/**
 * tags.delete - Delete a tag (also removes all entry-tag associations)
 */
export const deleteTag = protectedProcedure
	.input(GetTagInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id

		// First check if the tag exists and belongs to the user
		const [existingTag] = await db
			.select()
			.from(tags)
			.where(and(eq(tags.id, input.id), eq(tags.userId, userId)))
			.limit(1)

		if (!existingTag) {
			throw new ORPCError('NOT_FOUND', { message: 'Tag not found' })
		}

		// Delete the tag (entry_tags will be cascade deleted due to FK constraint)
		await db.delete(tags).where(and(eq(tags.id, input.id), eq(tags.userId, userId)))

		return { success: true }
	})

/**
 * tags.get - Get a single tag by ID
 */
export const getTag = protectedProcedure
	.input(GetTagInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id

		const [tag] = await db
			.select()
			.from(tags)
			.where(and(eq(tags.id, input.id), eq(tags.userId, userId)))
			.limit(1)

		if (!tag) {
			throw new ORPCError('NOT_FOUND', { message: 'Tag not found' })
		}

		return tag
	})

/**
 * tags.list - List all tags for the current user
 */
export const listTags = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id

	const userTags = await db
		.select()
		.from(tags)
		.where(eq(tags.userId, userId))
		.orderBy(tags.name)

	return userTags
})

/**
 * tags.getEntriesCount - Get the count of entries for each tag
 */
export const getTagEntriesCount = protectedProcedure
	.input(GetTagInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id

		// First verify the tag belongs to the user
		const [tag] = await db
			.select()
			.from(tags)
			.where(and(eq(tags.id, input.id), eq(tags.userId, userId)))
			.limit(1)

		if (!tag) {
			throw new ORPCError('NOT_FOUND', { message: 'Tag not found' })
		}

		// Count entries with this tag
		const associations = await db
			.select()
			.from(entryTags)
			.where(eq(entryTags.tagId, input.id))

		return { count: associations.length }
	})

/**
 * Tags router - all tag-related procedures
 */
export const tagsRouter = {
	create: createTag,
	update: updateTag,
	delete: deleteTag,
	get: getTag,
	list: listTags,
	getEntriesCount: getTagEntriesCount,
}
