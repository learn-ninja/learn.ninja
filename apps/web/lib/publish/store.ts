import { join } from "node:path"

import { Redis } from "@upstash/redis"
import { and, eq, gt, isNotNull, isNull, lte, or } from "drizzle-orm"

import { connectNeon, connectPglite, lesson, type Db } from "@workspace/db"
import type { Prepared } from "@workspace/player"
import type { Lesson } from "@workspace/spec"

// Where published lessons live. The app only talks to LessonStore, which keeps them in Postgres:
// Neon in production (DATABASE_URL), PGlite in a local folder in development and in memory in tests.

export const LESSON_TTL_SECONDS = 7 * 24 * 60 * 60

export interface StoredLesson {
  id: string
  slug: string
  spec: string
  lesson: Lesson
  /** Formulas, code, and visuals CSS, prepared once at publish time. */
  prepared: Prepared
  editTokenHash: string
  createdAt: number
  /** Null when it never expires (owned lessons, from phase 2 of plans/accounts-v2.md). */
  expiresAt: number | null
  updatedAt?: number
}

export interface LessonStore {
  /** Saves a new lesson, which expires at record.expiresAt. */
  create(record: StoredLesson): Promise<void>
  /** A lesson that hasn't expired, or null. */
  get(id: string): Promise<StoredLesson | null>
  /** Replaces a lesson without changing when it expires. */
  update(record: StoredLesson): Promise<void>
  /** Deletes every lesson that has expired, and says how many. */
  deleteExpired(): Promise<number>
}

export class PostgresLessonStore implements LessonStore {
  constructor(
    private db: Db,
    private now = () => Date.now()
  ) {}

  async create(record: StoredLesson) {
    await this.db.insert(lesson).values({
      id: record.id,
      slug: record.slug,
      spec: record.spec,
      lesson: record.lesson,
      prepared: record.prepared,
      editTokenHash: record.editTokenHash,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt ?? record.createdAt),
      expiresAt: record.expiresAt === null ? null : new Date(record.expiresAt),
    })
  }

  async get(id: string) {
    const [row] = await this.db
      .select()
      .from(lesson)
      .where(
        and(
          eq(lesson.id, id),
          or(isNull(lesson.expiresAt), gt(lesson.expiresAt, this.date()))
        )
      )
    if (!row) return null
    return {
      id: row.id,
      slug: row.slug,
      spec: row.spec,
      lesson: row.lesson as Lesson,
      prepared: row.prepared as Prepared,
      editTokenHash: row.editTokenHash,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      expiresAt: row.expiresAt?.getTime() ?? null,
    }
  }

  async update(record: StoredLesson) {
    await this.db
      .update(lesson)
      .set({
        slug: record.slug,
        spec: record.spec,
        lesson: record.lesson,
        prepared: record.prepared,
        updatedAt: new Date(record.updatedAt ?? this.now()),
      })
      .where(eq(lesson.id, record.id))
  }

  async deleteExpired() {
    const deleted = await this.db
      .delete(lesson)
      .where(
        and(isNotNull(lesson.expiresAt), lte(lesson.expiresAt, this.date()))
      )
      .returning({ id: lesson.id })
    return deleted.length
  }

  private date = () => new Date(this.now())
}

// ---------- choosing a database ----------

/** Upstash credentials, under the names Upstash or the Vercel Marketplace integration set. Used for rate limits. */
export function redisFromEnv(env = process.env): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  return url && token ? new Redis({ url, token }) : null
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Lesson storage isn't configured. Add a Postgres database (DATABASE_URL), such as Neon from the Vercel Marketplace."
    )
  }
}

/** Neon when DATABASE_URL is set; otherwise PGlite in a local folder, outside production unless LEARN_PGLITE_DIR names one. */
async function connect(env = process.env): Promise<Db> {
  if (env.DATABASE_URL) return connectNeon(env.DATABASE_URL)
  if (env.NODE_ENV === "production" && !env.LEARN_PGLITE_DIR)
    throw new StorageNotConfiguredError()
  return connectPglite(
    env.LEARN_PGLITE_DIR ?? join(process.cwd(), ".data/pglite")
  )
}

// Kept on globalThis so hot reloads in development reuse one PGlite instance: two on the same
// folder would corrupt it.
const shared = globalThis as { lessonStore?: Promise<LessonStore> }

export function getLessonStore(): Promise<LessonStore> {
  if (!shared.lessonStore) {
    const pending = connect().then((db) => new PostgresLessonStore(db))
    // A failed connection isn't kept, so the next request tries again.
    pending.catch(() => {
      if (shared.lessonStore === pending) shared.lessonStore = undefined
    })
    shared.lessonStore = pending
  }
  return shared.lessonStore
}
