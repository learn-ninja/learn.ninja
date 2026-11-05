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
}

/** A fetch for paths on the API (`/api/…`) that carries the session. */
export function createApiFetch({
  base,
  cookie,
  fetch: f = fetch,
}: ApiFetchDeps) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers)
    if (!headers.has("accept")) headers.set("accept", "application/json")
    const session = await cookie().catch(() => "")
    if (session) headers.set("cookie", session)
    return f(`${base}${path}`, { ...init, headers, credentials: "omit" })
  }
}
