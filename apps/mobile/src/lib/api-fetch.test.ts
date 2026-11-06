import { describe, expect, it, vi } from "vitest"

import { createApiFetch, OfflineError } from "./api-fetch"

describe("the API's fetch", () => {
  it("puts the session cookie on every request, and leaves the system's cookie jar out", async () => {
    const f = vi.fn(async () => new Response("{}"))
    const api = createApiFetch({
      base: "https://learn.test",
      cookie: async () => "__Secure-better-auth.session_token=abc",
      fetch: f,
    })
    await api("/api/explore", { method: "GET" })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://learn.test/api/explore")
    expect(init.credentials).toBe("omit")
    const headers = new Headers(init.headers)
    expect(headers.get("cookie")).toBe("__Secure-better-auth.session_token=abc")
    expect(headers.get("accept")).toBe("application/json")
  })

  it("sends no cookie when signed out, or when the keychain can't be read", async () => {
    for (const cookie of [
      async () => "",
      async () => Promise.reject(new Error("locked")),
    ]) {
      const f = vi.fn(async () => new Response("{}"))
      await createApiFetch({ base: "https://learn.test", cookie, fetch: f })(
        "/api/lessons/x/progress",
        { method: "PUT", headers: { "content-type": "application/json" } }
      )
      const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
      const headers = new Headers(init.headers)
      expect(headers.has("cookie")).toBe(false)
      expect(headers.get("content-type")).toBe("application/json")
    }
  })
})

describe("a request that doesn't reach the server", () => {
  const base = "https://learn.test"
  const cookie = async () => ""

  it("throws an OfflineError when there's no connection", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("Network request failed")
    })
    await expect(
      createApiFetch({ base, cookie, fetch: f })("/api/lessons/x")
    ).rejects.toEqual(new OfflineError(false))
  })

  it("gives up on a server that never answers", async () => {
    const f = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          )
        })
    )
    const error = await createApiFetch({ base, cookie, fetch: f, timeout: 20 })(
      "/api/lessons/x"
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OfflineError)
    expect((error as OfflineError).timedOut).toBe(true)
  })

  it("passes the server's own answers through, errors included", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 500 }))
    const res = await createApiFetch({ base, cookie, fetch: f })("/api/explore")
    expect(res.status).toBe(500)
  })
})
