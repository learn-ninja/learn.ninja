// Every request the app makes to the web app's API, with the session cookie on it once the learner
// has signed in. Better Auth's Expo client keeps the cookie in the keychain (expo-secure-store) and
// hands it out with getCookie(); React Native's own cookie jar is left out of it (credentials:
// "omit"), so the cookie sent is always the one the auth client holds, as Better Auth's Expo guide
// says to do. Kept free of Expo imports so it's tested in Node.

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface ApiFetchDeps {
  base: string
  /** The session cookie as a Cookie header's value, or "" when signed out. */
  cookie: () => Promise<string>
  fetch?: FetchLike
  /** How long a request may take, body and all, before it's given up on (ms). */
  timeout?: number
}

/** How long a request to the API may take before the app stops waiting: 15 seconds. */
export const REQUEST_TIMEOUT = 15_000

/**
 * The server couldn't be reached: no connection, or it didn't answer in time. Screens say so in
 * the player's words (t.offline) and offer to try again, rather than showing the system's message.
 */
export class OfflineError extends Error {
  constructor(readonly timedOut = false) {
    super(
      timedOut
        ? "The server didn't answer in time."
        : "The server couldn't be reached."
    )
  }
}

/**
 * A fetch for paths on the API (`/api/…`) that carries the session. A request that fails to reach
 * the server (fetch itself rejects) or takes longer than the timeout throws an OfflineError, so a
 * server that never answers doesn't leave a spinner up forever.
 */
export function createApiFetch({
  base,
  cookie,
  fetch: f = fetch,
  timeout = REQUEST_TIMEOUT,
}: ApiFetchDeps) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers)
    if (!headers.has("accept")) headers.set("accept", "application/json")
    const session = await cookie().catch(() => "")
    if (session) headers.set("cookie", session)
    // The timer isn't cleared when the headers arrive: it bounds reading the body too, and aborting
    // a request that's already finished does nothing.
    const controller = new AbortController()
    let timedOut = false
    setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)
    init.signal?.addEventListener("abort", () => controller.abort())
    try {
      return await f(`${base}${path}`, {
        ...init,
        headers,
        credentials: "omit",
        signal: controller.signal,
      })
    } catch (e) {
      // The caller's own abort is theirs to handle.
      if (init.signal?.aborted) throw e
      throw new OfflineError(timedOut)
    }
  }
}
