import { eq, sql } from "drizzle-orm"
import type { Redis } from "@upstash/redis"

import { lesson, type Db } from "@workspace/db"

// View counts. A lesson page records a view each time it opens (the beacon in
// components/explore/view-beacon.tsx), counted after the response is sent.
// With Redis the views pile up in a hash and are added to lesson.views in one write after an Explore
// page (at most once a minute) and by the daily cron; without it (development, tests) each view is written
// through to Postgres at once. Explore shows lesson.views plus what's pending, so a view shows at once.

export interface ViewCounter {
  /** One more view for `id`. */
  record(id: string): Promise<void>
  /**
   * Hands every view not yet in Postgres to `write`, as lesson id → count, and forgets them once
   * it succeeds. If it throws, the views are kept for the next drain.
   */
  drain(write: (counts: Record<string, number>) => Promise<void>): Promise<void>
  /** The views of `ids` not yet in Postgres, without taking them. Ids with none are left out. */
  pending(ids: string[]): Promise<Map<string, number>>
  /** True at most once every `seconds` across every server, for a flush that needn't run on each request. */
  due(seconds: number): Promise<boolean>
}

// The keys keep the names they had when these were plays, so nothing pending is lost on deploy.
const PENDING = "plays:pending"
const FLUSH_LOCK = "plays:flushed-recently"

export class RedisViewCounter implements ViewCounter {
  constructor(private redis: Redis) {}

  async record(id: string) {
    await this.redis.hincrby(PENDING, id, 1)
  }

  async drain(write: (counts: Record<string, number>) => Promise<void>) {
    // Moved aside first, so views recorded while this runs land in the next batch and two drains
    // at once never count the same batch twice: RENAME fails for the second one.
    const batch = `plays:flushing:${Date.now()}:${Math.random().toString(36).slice(2)}`
    try {
      await this.redis.rename(PENDING, batch)
    } catch {
      return
    }
    const counts = await this.redis.hgetall<Record<string, number>>(batch)
    const out: Record<string, number> = {}
    for (const [id, n] of Object.entries(counts ?? {})) out[id] = Number(n)
    try {
      await write(out)
    } catch (e) {
      // Not written: the batch goes back to wait for the next drain.
      const back = this.redis.pipeline()
      for (const [id, n] of Object.entries(out)) back.hincrby(PENDING, id, n)
      await back.exec()
      throw e
    } finally {
      await this.redis.del(batch)
    }
  }

  async pending(ids: string[]) {
    // A batch a drain has moved aside but not yet written is in neither place for those few
    // milliseconds, so a count can dip by its views for one request.
    if (!ids.length) return new Map()
    const counts = await this.redis.hmget<Record<string, number | null>>(
      PENDING,
      ...ids
    )
    const out = new Map<string, number>()
    for (const [id, n] of Object.entries(counts ?? {}))
      if (n) out.set(id, Number(n))
    return out
  }

  async due(seconds: number) {
    return (
      (await this.redis.set(FLUSH_LOCK, 1, { nx: true, ex: seconds })) === "OK"
    )
  }
}

/** Without Redis: every view goes straight to lesson.views. */
export class WriteThroughViewCounter implements ViewCounter {
  constructor(private db: Db) {}

  async record(id: string) {
    await this.db
      .update(lesson)
      .set({ views: sql`${lesson.views} + 1` })
      .where(eq(lesson.id, id))
  }

  async drain() {}

  async pending() {
    return new Map<string, number>()
  }

  async due() {
    return true
  }
}

/** Keeps views in memory until drained; for tests of the flush. */
export class MemoryViewCounter implements ViewCounter {
  private counts = new Map<string, number>()

  async record(id: string) {
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1)
  }

  async drain(write: (counts: Record<string, number>) => Promise<void>) {
    await write(Object.fromEntries(this.counts))
    this.counts.clear()
  }

  async due() {
    return true
  }

  async pending(ids: string[]) {
    return new Map(
      ids.flatMap((id) => {
        const n = this.counts.get(id)
        return n ? [[id, n] as const] : []
      })
    )
  }
}

/**
 * Adds the drained views to lesson.views in one statement, skipping ids that aren't lessons (a
 * beacon only checks an id's shape). Returns how many views were written. With `every`, does
 * nothing unless that many seconds have passed since the last flush that asked the same.
 */
export async function flushViews(
  db: Db,
  counter: ViewCounter,
  { every }: { every?: number } = {}
): Promise<number> {
  if (every && !(await counter.due(every))) return 0
  let total = 0
  await counter.drain(async (counts) => {
    const rows = Object.entries(counts).filter(([, n]) => n > 0)
    if (!rows.length) return
    const values = sql.join(
      rows.map(([id, n]) => sql`(${id}, ${Math.round(n)}::integer)`),
      sql`, `
    )
    const written = await db
      .update(lesson)
      .set({ views: sql`${lesson.views} + pending.n` })
      .from(sql`(values ${values}) as pending(id, n)`)
      .where(sql`${lesson.id} = pending.id`)
      .returning({ n: sql<number>`pending.n` })
    total = written.reduce((sum, row) => sum + Number(row.n), 0)
  })
  return total
}
