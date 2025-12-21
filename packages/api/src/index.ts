import { ORPCError, os } from '@orpc/server'
import type { Context } from './context'
import { getLocalizedErrorMessage } from './utils/i18n'

export const o = os.$context<Context>()

export const publicProcedure = o

const requireAuth = o.middleware(({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError('UNAUTHORIZED', {
			message: getLocalizedErrorMessage('unauthorized', context.locale),
		})
	}
	return next({
		context: {
			session: context.session,
		},
	})
})

export const protectedProcedure = publicProcedure.use(requireAuth)
