import type { HttpHandler } from 'msw'
import { setupServer } from 'msw/node'

// Placeholder - add handlers when needed
export const handlers: HttpHandler[] = [
	// Example placeholder:
	// http.get('https://api.stripe.com/v1/*', () =>
	//   HttpResponse.json({ mock: true })
	// )
]

export const server = setupServer(...handlers)
