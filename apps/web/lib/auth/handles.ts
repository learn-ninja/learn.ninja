import { eq } from "drizzle-orm"

import { user, type Db } from "@workspace/db"

// Handles: the public name in /u/{handle}. GitHub users get their login (made unique if taken);
// email users pick one the first time they open the site signed in.

export const HANDLE_RULES =
  "3 to 30 characters: lowercase letters, numbers, and hyphens, starting with a letter or number."

/** Paths and names a handle could be confused with. */
const RESERVED = new Set([
  "admin",
  "api",
  "docs",
  "explore",
  "keep",
  "l",
  "learn",
  "lessons",
  "login",
  "logout",
  "me",
  "ninja",
  "privacy",
  "settings",
  "sign-in",
  "signin",
  "sign-out",
  "signout",
  "support",
  "team",
  "teams",
  "terms",
  "u",
  "user",
  "users",
  "www",
])

/** "@Colin_Pace" → "colin-pace"; what's left of a GitHub login or a typed name once the rules apply. */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "")
}

/** Why `handle` can't be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle))
    return `Handles are ${HANDLE_RULES}`
  if (RESERVED.has(handle)) return "That handle is reserved."
  return null
}

/** The user who has `handle`, if any. */
export async function findByHandle(db: Db, handle: string) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.handle, handle))
  return row ?? null
}

/**
 * A handle close to `wanted` that nobody has: the normalized name itself, or with a number after
 * it ("colin", "colin-2", "colin-3"...). Used for GitHub logins at first sign-in.
 */
export async function freeHandle(db: Db, wanted: string): Promise<string> {
  const base = normalizeHandle(wanted).padEnd(3, "0") || "ninja"
  const stem = RESERVED.has(base) ? `${base}-1` : base
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? stem : `${stem.slice(0, 30 - 1 - String(n).length)}-${n}`
    if (!(await findByHandle(db, candidate))) return candidate
  }
  throw new Error(`No free handle near ${wanted}`)
}
