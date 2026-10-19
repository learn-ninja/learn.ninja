import { eq, sql } from "drizzle-orm"
import type { Redis } from "@upstash/redis"

import { lesson, type Db } from "@workspace/db"

// Play counts. A lesson page records one play per browser per day (the beacon in
// components/explore/play-beacon.tsx, deduplicated in localStorage) after the response is sent.
// With Redis the plays pile up in a hash and are added to lesson.plays in one write when the Explore
// lists revalidate or the daily cron runs; without it (development, tests) each play is written
// through to Postgres at once.

export interface PlayCounter {
  /** One more play for `id`. */
  record(id: string): Promise<void>
  /** Takes every play not yet in Postgres, as lesson id → count, and forgets it. */
  drain(): Promise<Record<string, number>>
}

const PENDING = "plays:pending"

export class RedisPlayCounter implements PlayCounter {
  constructor(private redis: Redis) {}

  async record(id: string) {
    await this.redis.hincrby(PENDING, id, 1)
  }

  async drain() {
    // Moved aside first, so plays recorded while this runs land in the next batch and two drains
    // at once never count the same batch twice: RENAME fails for the second one.
    const batch = `plays:flushing:${Date.now()}:${Math.random().toString(36).slice(2)}`
    try {
      await this.redis.rename(PENDING, batch)
    } catch {
      return {}
    }
    const counts = await this.redis.hgetall<Record<string, number>>(batch)
    await this.redis.del(batch)
    const out: Record<string, number> = {}
    for (const [id, n] of Object.entries(counts ?? {})) out[id] = Number(n)
    return out
  }
}

/** Without Redis: every play goes straight to lesson.plays. */
export class WriteThroughPlayCounter implements PlayCounter {
  constructor(private db: Db) {}

  async record(id: string) {
    await this.db
      .update(lesson)
      .set({ plays: sql`${lesson.plays} + 1` })
      .where(eq(lesson.id, id))
  }

  async drain() {
    return {}
  }
}

/** Keeps plays in memory until drained; for tests of the flush. */
export class MemoryPlayCounter implements PlayCounter {
  private counts = new Map<string, number>()

  async record(id: string) {
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1)
  }

  async drain() {
    const out = Object.fromEntries(this.counts)
    this.counts.clear()
    return out
  }
}

/** Adds the drained plays to lesson.plays. Returns how many plays were written. */
export async function flushPlays(
  db: Db,
  counter: PlayCounter
): Promise<number> {
  const counts = await counter.drain()
  let total = 0
  for (const [id, n] of Object.entries(counts)) {
    if (!(n > 0)) continue
    await db
      .update(lesson)
      .set({ plays: sql`${lesson.plays} + ${n}` })
      .where(eq(lesson.id, id))
    total += n
  }
  return total
}
