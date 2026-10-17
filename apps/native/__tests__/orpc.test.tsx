import { afterEach, expect, it, vi } from "vite-plus/test"

const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }))

vi.mock("@/lib/auth-client", () => ({ authClient: { getCookie } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it("waits for the session cookie before sending an authenticated request", async () => {
  vi.stubEnv("EXPO_PUBLIC_SERVER_URL", "https://example.com")
  const cookie = Promise.withResolvers<string>()
  getCookie.mockReturnValue(cookie.promise)
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({ json: { ok: true } })
  )
  vi.stubGlobal("fetch", fetchMock)
  const { link } = await import("../utils/orpc")

  const request = link.call(["check"], undefined, { context: {} })
  await vi.waitFor(() => expect(getCookie).toHaveBeenCalledOnce())
  expect(fetchMock).not.toHaveBeenCalled()

  cookie.resolve("better-auth.session_token=test-session")
  await expect(request).resolves.toEqual({ ok: true })
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error("Expected an authenticated request")
  const [input, init] = call
  expect(new Request(input, init).headers.get("Cookie")).toBe(
    "better-auth.session_token=test-session"
  )
})
