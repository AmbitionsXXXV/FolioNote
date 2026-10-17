import { expect, it, vi } from "vite-plus/test"

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
}))

vi.mock("undici", async (importOriginal) => {
  const undici = await importOriginal<typeof import("undici")>()
  return {
    ...undici,
    Agent: class extends undici.MockAgent {
      constructor() {
        super()
        this.disableNetConnect()
        this.get("https://example.com")
          .intercept({ path: "/article" })
          .reply(200, "Article content", {
            headers: { "content-type": "text/plain" }
          })
      }

      override async destroy() {
        await this.close()
      }
    }
  }
})

import { fetchUrlContent } from "../src/web-fetch/api/fetch-url"

it("reads a response through the real Undici fetch and dispatcher protocol", async () => {
  await expect(
    fetchUrlContent("https://example.com/article", "text")
  ).resolves.toEqual({
    url: "https://example.com/article",
    contentType: "text/plain",
    content: "Article content",
    format: "text"
  })
})
