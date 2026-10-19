import { PgDialect } from "drizzle-orm/pg-core"
import { beforeEach, expect, it, vi } from "vite-plus/test"

const { getAccessToken, limit, where } = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  limit: vi.fn(),
  where: vi.fn()
}))

vi.mock("@folionote/auth", () => ({ auth: { api: { getAccessToken } } }))
vi.mock("@folionote/db", async () => {
  const { account } = await import("../../../db/src/schema/auth")
  return {
    account,
    db: { select: () => ({ from: () => ({ where }) }) }
  }
})

import { getGoogleDocsToken } from "../../src/connectors/google-docs"

beforeEach(() => {
  vi.resetAllMocks()
  where.mockReturnValue({ limit })
})

it("selects the current user's Google account and passes its local row ID", async () => {
  limit.mockResolvedValue([{ id: "local-account-id" }])
  getAccessToken.mockResolvedValue({
    accessToken: "test-token",
    scopes: ["https://www.googleapis.com/auth/drive.file"]
  })

  await expect(getGoogleDocsToken("owner-user-id")).resolves.toBe("test-token")

  const predicate = where.mock.calls[0]?.[0]
  if (!predicate) throw new Error("Expected an account ownership filter")
  const query = new PgDialect().sqlToQuery(predicate)
  expect(query.sql).toContain('"account"."user_id"')
  expect(query.sql).toContain('"account"."provider_id"')
  expect(query.params).toEqual(["owner-user-id", "google"])
  expect(limit).toHaveBeenCalledWith(1)
  expect(getAccessToken).toHaveBeenCalledWith({
    body: { accountId: "local-account-id", userId: "owner-user-id" }
  })
})

it("does not request a token when the user has no Google account", async () => {
  limit.mockResolvedValue([])

  await expect(getGoogleDocsToken("other-user-id")).rejects.toThrow(
    "Google account not linked"
  )
  expect(getAccessToken).not.toHaveBeenCalled()
})
