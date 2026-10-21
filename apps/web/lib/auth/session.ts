import { cache } from "react"
import { headers } from "next/headers"

import { getActor, type Actor } from "./actor"
import { getAuth } from "./auth"

export type { Actor }

/**
 * The logged-in user behind the current server render, or null. Reads the request headers first:
 * that marks the page dynamic, so `next build` never prerenders it (and never opens the database
 * on a build machine without one). Memoized per request, so a layout and its page both asking
 * cost one session check.
 */
export const currentActor = cache(async (): Promise<Actor | null> => {
  const h = await headers()
  return getActor(await getAuth(), h)
})

/**
 * A safe place to send the browser after logging in: a site path, never another site. One slash,
 * then anything but a slash or backslash (browsers read "/\\evil.com" as "//evil.com").
 */
export function safeCallback(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value
  return path && /^\/(?![/\\])/.test(path) ? path : "/explore"
}

type SearchParams = Record<string, string | string[] | undefined>

/** The page's query string, as the browser sent it. */
export function queryOf(params: SearchParams): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value])
      q.append(key, v)
  }
  return q.toString()
}

/**
 * Where to go after logging in when a chat app's OAuth request brought the user here: Better Auth
 * sends a logged-out user to /login with the whole authorize request (client_id, redirect_uri,
 * scope, PKCE challenge…) logged into the query, and once a session exists, re-entering
 * /api/auth/oauth2/authorize with that same query carries on to consent and back to the app.
 * Null when the query isn't one of those.
 */
export function oauthResume(params: SearchParams): string | null {
  if (!params.client_id || !params.sig) return null
  return `/api/auth/oauth2/authorize?${queryOf(params)}`
}
