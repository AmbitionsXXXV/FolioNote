import { serve } from '@hono/node-server'
import dotenv from 'dotenv'
import { createApp } from './app'
import { initI18n } from './i18n'

// Load environment-specific .env file
const nodeEnv = process.env.NODE_ENV || 'development'
dotenv.config({ path: `.env.${nodeEnv}`, override: true })
dotenv.config({ path: '.env' })

await initI18n()

const app = createApp()

const port = Number(process.env.PORT) || 3000

console.log(`Server is running on http://localhost:${port}`)

serve({
	fetch: app.fetch,
	port,
})

export default app
