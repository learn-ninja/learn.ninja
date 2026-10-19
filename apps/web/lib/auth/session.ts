import { headers } from "next/headers"

import { getActor, type Actor } from "./actor"
import { getAuth } from "./auth"

export type { Actor }

/** The signed-in user behind the current server render, or null. Makes the page dynamic. */
export async function currentActor(): Promise<Actor | null> {
  return getActor(await getAuth(), await headers())
}

/** A safe place to send the browser after signing in: a site path, never another site. */
export function safeCallback(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value
  return path && /^\/(?!\/)/.test(path) ? path : "/settings"
}
