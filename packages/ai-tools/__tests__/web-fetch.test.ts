import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

const { mockLookup, mockFetch, agents } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockFetch: vi.fn(),
  agents: [] as import("undici").Agent.Options[]
}))
vi.mock("undici", () => ({
  fetch: mockFetch,
  Agent: class {
    constructor(options: import("undici").Agent.Options) {
      agents.push(options)
    }
    async destroy() {}
  }
}))

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup
}))

import { fetchUrlContent, fetchUrlBytes } from "../src/web-fetch/api/fetch-url"

beforeEach(() => {
  agents.length = 0
  vi.clearAllMocks()
  mockFetch.mockReset()
  vi.unstubAllGlobals()
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
})

describe("fetchUrlContent", () => {
  it("rejects loopback IP addresses before issuing a request", async () => {
    const fetchMock = vi.fn()
    mockFetch.mockImplementation(fetchMock)

    await expect(fetchUrlContent("http://127.0.0.1/private")).rejects.toThrow(
      "URL resolves to a private, loopback, or otherwise non-public address"
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects single-label internal hostnames", async () => {
    const fetchMock = vi.fn()
    mockFetch.mockImplementation(fetchMock)

    await expect(fetchUrlContent("http://redis/admin")).rejects.toThrow(
      "URL resolves to a private, loopback, or otherwise non-public address"
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects hostnames that resolve to private IP space", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.12.8", family: 4 }])
    const fetchMock = vi.fn()
    mockFetch.mockImplementation(fetchMock)

    await expect(
      fetchUrlContent("https://internal.example.com")
    ).rejects.toThrow(
      "URL resolves to a private, loopback, or otherwise non-public address"
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects redirect targets that jump into private networks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.redirect("http://169.254.169.254/latest/meta-data", 302)
      )

    mockFetch.mockImplementation(fetchMock)

    await expect(
      fetchUrlContent("https://example.com/redirect")
    ).rejects.toThrow(
      "URL resolves to a private, loopback, or otherwise non-public address"
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("follows safe redirects and returns formatted content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/docs/page" }
        })
      )
      .mockResolvedValueOnce(
        new Response("<html><body><h1>Hello</h1><p>World</p></body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        })
      )

    mockFetch.mockImplementation(fetchMock)

    const result = await fetchUrlContent("https://example.com/start", "text")

    expect(result.url).toBe("https://example.com/start")
    expect(result.format).toBe("text")
    expect(result.contentType).toContain("text/html")
    expect(result.content).toContain("Hello")
    expect(result.content).toContain("World")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("rejects URLs with embedded credentials", async () => {
    const fetchMock = vi.fn()
    mockFetch.mockImplementation(fetchMock)

    await expect(
      fetchUrlContent("https://user:pass@example.com")
    ).rejects.toThrow("URL must not include embedded credentials")

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// Exercise the actual lookup supplied to the dispatcher, without opening sockets.
function connectLookup(all = true): Promise<unknown> {
  const connect = agents.at(-1)?.connect
  if (
    !connect ||
    typeof connect === "function" ||
    !("lookup" in connect) ||
    !connect.lookup
  ) {
    return Promise.reject(new Error("No connect-time DNS guard"))
  }
  const lookup = connect.lookup
  return new Promise((resolve, reject) => {
    lookup("example.com", { all }, (error, address, family) => {
      if (error) reject(error)
      else resolve({ address, family })
    })
  })
}

describe("connect-time DNS validation", () => {
  it("rejects a private address returned after a public preflight", async () => {
    mockLookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }])
    mockFetch.mockImplementation(
      vi.fn(async () => {
        await connectLookup()
        return new Response("unsafe")
      })
    )
    await expect(fetchUrlContent("https://example.com")).rejects.toThrow(
      "non-public"
    )
  })
  it.each([true, false])(
    "returns only vetted public addresses (all=%s)",
    async (all) => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
      mockFetch.mockImplementation(
        vi.fn(async (url, options) => {
          expect(String(url)).toBe("https://example.com/")
          expect(options.dispatcher).toBeDefined()
          const result = await connectLookup(all)
          expect(result).toEqual(
            all
              ? {
                  address: [{ address: "93.184.216.34", family: 4 }],
                  family: undefined
                }
              : { address: "93.184.216.34", family: 4 }
          )
          return new Response("safe")
        })
      )
      const result = await fetchUrlContent("https://example.com", "text")
      expect(result.content).toBe("safe")
    }
  )
  it.each([
    "64:ff9b::7f00:1",
    "64:ff9b::a00:1",
    "2002:7f00:1::",
    "2002:c0a8:101::"
  ])("rejects embedded private IPv4 in %s", async (address) => {
    mockLookup.mockResolvedValue([{ address, family: 6 }])
    mockFetch.mockImplementation(vi.fn())
    await expect(fetchUrlContent("https://example.com")).rejects.toThrow(
      "non-public"
    )
    await expect(fetchUrlContent(`https://[${address}]/`)).rejects.toThrow(
      "non-public"
    )
  })
})

it.each(["redirect", "challenge"])(
  "checks the connection again after a %s",
  async (kind) => {
    const publicAddress = [{ address: "93.184.216.34", family: 4 }]
    mockLookup
      .mockResolvedValueOnce(publicAddress)
      .mockResolvedValueOnce(publicAddress)
    if (kind === "redirect") mockLookup.mockResolvedValueOnce(publicAddress)
    mockLookup.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }])
    let requests = 0
    mockFetch.mockImplementation(
      vi.fn(async (_url, options) => {
        expect(options.dispatcher).toBeDefined()
        await connectLookup()
        requests += 1
        return requests === 1
          ? new Response(
              null,
              kind === "redirect"
                ? {
                    status: 302,
                    headers: { location: "https://example.com/next" }
                  }
                : { status: 403, headers: { "cf-mitigated": "challenge" } }
            )
          : new Response("unsafe")
      })
    )
    await expect(fetchUrlContent("https://example.com")).rejects.toThrow(
      "non-public"
    )
  }
)

it("returns undecoded bytes and the original content type to byte callers", async () => {
  const bytes = new Uint8Array([0x93, 0xfa, 0x96, 0x7b])
  mockFetch.mockImplementation(
    vi.fn(
      async () =>
        new Response(bytes, {
          headers: { "content-type": "text/html; charset=shift_jis" }
        })
    )
  )
  expect(await fetchUrlBytes("https://example.com")).toEqual({
    url: "https://example.com/",
    bytes,
    contentType: "text/html; charset=shift_jis"
  })
})
