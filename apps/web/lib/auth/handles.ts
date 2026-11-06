import { eq, isNull } from "drizzle-orm"

import { user, type Db } from "@workspace/db"

import { normalizeHandle, randomHandleName, RESERVED } from "@workspace/player-core/handle-rules"

export * from "@workspace/player-core/handle-rules"

// GitHub users get their login (made unique if taken); everyone else a random one, like
// "quiet-kitsune". Either can be changed in settings.

/** The user who has `handle`, if any. */
export async function findByHandle(db: Db, handle: string) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.handle, handle))
  return row ?? null
}

/** The handle of the user with `id`, or null: no such user, or none picked yet. */
export async function handleOf(db: Db, id: string): Promise<string | null> {
  const [row] = await db
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, id))
  return row?.handle ?? null
}

/**
 * A handle close to `wanted` that nobody has: the normalized name itself, or with a number after
 * it ("colin", "colin-2", "colin-3"...). Used for GitHub logins at first log-in.
 */
export async function freeHandle(db: Db, wanted: string): Promise<string> {
  const base = (normalizeHandle(wanted) || "ninja").padEnd(3, "0")
  const stem = RESERVED.has(base) ? `${base}-1` : base
  for (let n = 1; n < 1000; n++) {
    const candidate =
      n === 1 ? stem : `${stem.slice(0, 30 - 1 - String(n).length)}-${n}`
    if (!(await findByHandle(db, candidate))) return candidate
  }
  throw new Error(`No free handle near ${wanted}`)
}

/**
 * A random handle nobody has, like "quiet-kitsune": a few fresh pairs first, then the last one
 * with a number ("quiet-kitsune-2"). Given to accounts that arrive without one.
 */
export async function randomHandle(
  db: Db,
  random: () => number = Math.random
): Promise<string> {
  let name = randomHandleName(random)
  for (let tries = 1; tries < 5; tries++) {
    if (!(await findByHandle(db, name))) return name
    name = randomHandleName(random)
  }
  return freeHandle(db, name)
}

/**
 * Gives every account without a handle a random one, for accounts made before handles were
 * assigned. Dry run unless `write`; returns what each account got.
 */
export async function backfillHandles(
  db: Db,
  { write = false }: { write?: boolean } = {}
): Promise<{ id: string; handle: string }[]> {
  const missing = await db
    .select({ id: user.id })
    .from(user)
    .where(isNull(user.handle))
  const given: { id: string; handle: string }[] = []
  for (const { id } of missing) {
    // Names given in a dry run aren't saved, so they can't collide with each other: check them too.
    let handle = await randomHandle(db)
    while (given.some((g) => g.handle === handle))
      handle = await randomHandle(db)
    if (write)
      await db
        .update(user)
        .set({ handle, updatedAt: new Date() })
        .where(eq(user.id, id))
    given.push({ id, handle })
  }
  return given
}
