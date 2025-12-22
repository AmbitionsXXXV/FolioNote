import * as Bun from 'bun'
import { describe, expect, it } from 'vitest'

describe('RootDocument: theme class should not be overwritten by language changes', () => {
	it('keeps langClass off <html> className to avoid wiping next-themes classes (e.g. dark)', async () => {
		const fileUrl = new URL('../src/routes/__root.tsx', import.meta.url)
		const source = await Bun.file(fileUrl).text()

		expect(source).not.toContain(
			"className={cn('no-scrollbar bg-background', langClass)}"
		)
		expect(source).toContain("className={cn('no-scrollbar bg-background')}")
		expect(source).toContain("className={cn('min-h-svh bg-background', langClass)}")
	})
})
