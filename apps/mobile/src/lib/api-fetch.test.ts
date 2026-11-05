import { describe, expect, it, vi } from "vitest"

import { createApiFetch } from "./api-fetch"

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
    for (const cookie of [async () => "", async () => Promise.reject(new Error("locked"))]) {
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
