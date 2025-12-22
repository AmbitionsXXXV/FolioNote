import { db, entries } from '@folio/db'
import { and, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure } from '../index'

/**
 * Input schema for search
 */
const SearchInputSchema = z.object({
	query: z.string().min(1).max(500),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(20),
})

/**
 * search.entries - Search entries by keyword (title/content)
 */
export const searchEntries = protectedProcedure
	.input(SearchInputSchema)
	.handler(async ({ context, input }) => {
		const userId = context.session.user.id
		const { query, cursor, limit } = input

		// Build search pattern for ILIKE (case-insensitive)
		const searchPattern = `%${query}%`

		const conditions = [
			eq(entries.userId, userId),
			isNull(entries.deletedAt),
			or(
				ilike(entries.title, searchPattern),
				ilike(entries.contentText, searchPattern)
			),
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

		const items = await db
			.select()
			.from(entries)
			.where(and(...conditions))
			.orderBy(desc(entries.updatedAt))
			.limit(limit + 1)

		const hasMore = items.length > limit
		const resultItems = hasMore ? items.slice(0, limit) : items
		const nextCursor = hasMore ? resultItems.at(-1)?.id : undefined

		return {
			items: resultItems,
			nextCursor,
			hasMore,
			query,
		}
	})

/**
 * Search router - all search-related procedures
 */
export const searchRouter = {
	entries: searchEntries,
}
