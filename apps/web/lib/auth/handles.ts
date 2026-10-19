import { eq } from "drizzle-orm"

import { user, type Db } from "@workspace/db"

import { normalizeHandle, RESERVED } from "./handle-rules"

export * from "./handle-rules"

// GitHub users get their login (made unique if taken); email users pick one the first time they
// open the site signed in.

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
