import { describe, expect, it, vi } from "vite-plus/test"

import { parseNotionPageId } from "../../src/connectors/notion"
import { decryptToken, encryptToken } from "../../src/connectors/token-crypto"

vi.mock("@folionote/auth", () => ({ auth: { api: {} } }))
vi.stubEnv("CONNECTOR_TOKEN_SECRET", "test-connector-secret-0123456789abcdef")

const { parseGoogleDocId } = await import("../../src/connectors/google-docs")

describe("token-crypto", () => {
  it("round-trips and never emits the plaintext", async () => {
    const sealed = await encryptToken("secret_notion_token")
    expect(sealed.startsWith("v1.")).toBe(true)
    expect(sealed).not.toContain("secret_notion_token")
    await expect(decryptToken(sealed)).resolves.toBe("secret_notion_token")
  })

  it("uses a fresh IV per encryption", async () => {
    const [a, b] = await Promise.all([
      encryptToken("same"),
      encryptToken("same")
    ])
    expect(a).not.toBe(b)
  })

  it("rejects tampered ciphertext", async () => {
    const sealed = await encryptToken("value")
    const [version, iv, data = ""] = sealed.split(".")
    const target = data.at(-2)
    const flipped = `${data.slice(0, -2)}${target === "A" ? "B" : "A"}${data.slice(-1)}`
    await expect(decryptToken(`${version}.${iv}.${flipped}`)).rejects.toThrow()
  })

  it("rejects unknown formats", async () => {
    await expect(decryptToken("plain")).rejects.toThrow("Unrecognized")
  })
})

describe("parseNotionPageId", () => {
  const id = "1429989fe8ac4effbc8f57f56486db54"
  const dashed = "1429989f-e8ac-4eff-bc8f-57f56486db54"

  it.each([
    [`https://www.notion.so/workspace/My-Page-${id}`],
    [`https://www.notion.so/${id}?v=abc`],
    [`https://team.notion.site/Page-${id}#heading`],
    [id],
    [dashed]
  ])("parses %s", (input) => {
    expect(parseNotionPageId(input)).toBe(dashed)
  })

  it("returns null for non-Notion input", () => {
    expect(parseNotionPageId("https://example.com/page")).toBeNull()
  })
})

describe("parseGoogleDocId", () => {
  const docId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-xy"

  it("parses edit links and raw ids", () => {
    expect(
      parseGoogleDocId(
        `https://docs.google.com/document/d/${docId}/edit?tab=t.0`
      )
    ).toBe(docId)
    expect(parseGoogleDocId(docId)).toBe(docId)
  })

  it("rejects other URLs", () => {
    expect(
      parseGoogleDocId("https://docs.google.com/spreadsheets/x")
    ).toBeNull()
  })
})
