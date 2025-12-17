import { drizzle } from 'drizzle-orm/node-postgres'
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from './schema/auth'

export const db = drizzle(process.env.DATABASE_URL || '', {
	schema: {
		user,
		userRelations,
		session,
		sessionRelations,
		account,
		accountRelations,
		verification,
	},
})
