import { headers } from "next/headers"

import { getActor, type Actor } from "./actor"
import { getAuth } from "./auth"

export type { Actor }

/**
 * The signed-in user behind the current server render, or null. Reads the request headers first:
 * that marks the page dynamic, so `next build` never prerenders it (and never opens the database
 * on a build machine without one).
 */
export async function currentActor(): Promise<Actor | null> {
  const h = await headers()
  return getActor(await getAuth(), h)
}

/**
 * A safe place to send the browser after signing in: a site path, never another site. One slash,
 * then anything but a slash or backslash (browsers read "/\\evil.com" as "//evil.com").
 */
export function safeCallback(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value
  return path && /^\/(?![/\\])/.test(path) ? path : "/settings"
}
