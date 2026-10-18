import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vite-plus/test"

describe("RootDocument: theme class should not be overwritten by language changes", () => {
  it("keeps langClass off <html> className to avoid wiping next-themes classes (e.g. dark)", async () => {
    // Under jsdom import.meta.url is not a file: URL, so resolve from the dir.
    const filePath = join(import.meta.dirname, "../src/routes/__root.tsx")
    const source = await readFile(filePath, "utf-8")

    expect(source).not.toContain(
      'className={cn("no-scrollbar bg-background", langClass)}'
    )
    expect(source).toContain('className={cn("no-scrollbar bg-background")}')
    expect(source).toContain(
      'className={cn("min-h-svh bg-background", langClass)}'
    )
  })
})
