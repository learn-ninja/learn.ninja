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
  /** The hash of the token that claims an anonymous lesson into an account; null once claimed or for owned lessons. */
  claimTokenHash: string | null
  /** The user who owns it; null for anonymous lessons. */
  ownerId: string | null
  /** Who sees it: in Explore ("public"), by link only ("unlisted"), or a team's later. Owned lessons start listed; anonymous ones are always unlisted. */
  visibility: "public" | "unlisted" | "team"
  /** Set by hand after a report: out of Explore and profiles, and only the owner can open the link. */
  hidden: boolean
  plays: number
  likes: number
  createdAt: number
  /** Null when it never expires (owned lessons). */
  expiresAt: number | null
  updatedAt?: number
}

export interface LessonStore {
  /** Saves a new lesson, which expires at record.expiresAt. */
  create(record: StoredLesson): Promise<void>
  /** A lesson that hasn't expired, or null. */
  get(id: string): Promise<StoredLesson | null>
  /** The unclaimed, unexpired lesson whose claim token hashes to `hash`, or null. */
  getByClaimTokenHash(hash: string): Promise<StoredLesson | null>
  /** Replaces a lesson without changing when it expires or who owns it. */
  update(record: StoredLesson): Promise<void>
  /** Gives a lesson to `ownerId`: it stops expiring, is listed in Explore, and its claim token stops working. Returns the lesson as it now is. */
  claim(id: string, ownerId: string): Promise<StoredLesson>
  /**
   * Replaces an anonymous lesson's claim token with the one that hashes to `hash`; the old one
   * stops working. False when nothing changed: the lesson is owned by now, or gone.
   */
  setClaimToken(id: string, hash: string): Promise<boolean>
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
      claimTokenHash: record.claimTokenHash,
      ownerId: record.ownerId,
      visibility: record.visibility,
      hidden: record.hidden,
      plays: record.plays,
      likes: record.likes,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt ?? record.createdAt),
      expiresAt: record.expiresAt === null ? null : new Date(record.expiresAt),
    })
  }

  async get(id: string) {
    const [row] = await this.db
      .select()
      .from(lesson)
      .where(and(eq(lesson.id, id), this.live()))
    return row ? toStored(row) : null
  }

  async getByClaimTokenHash(hash: string) {
    const [row] = await this.db
      .select()
      .from(lesson)
      .where(and(eq(lesson.claimTokenHash, hash), this.live()))
    return row ? toStored(row) : null
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

  async claim(id: string, ownerId: string) {
    const [row] = await this.db
      .update(lesson)
      .set({
        ownerId,
        claimTokenHash: null,
        expiresAt: null,
        visibility: "public",
        updatedAt: this.date(),
      })
      .where(eq(lesson.id, id))
      .returning()
    if (!row) throw new Error(`Lesson ${id} vanished while being claimed`)
    return toStored(row)
  }

  async setClaimToken(id: string, hash: string) {
    const changed = await this.db
      .update(lesson)
      .set({ claimTokenHash: hash, updatedAt: this.date() })
      .where(and(eq(lesson.id, id), isNull(lesson.ownerId), this.live()))
      .returning({ id: lesson.id })
    return changed.length > 0
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

  private live = () =>
    or(isNull(lesson.expiresAt), gt(lesson.expiresAt, this.date()))
  private date = () => new Date(this.now())
}

function toStored(row: typeof lesson.$inferSelect): StoredLesson {
  return {
    id: row.id,
    slug: row.slug,
    spec: row.spec,
    lesson: row.lesson as Lesson,
    prepared: row.prepared as Prepared,
    editTokenHash: row.editTokenHash,
    claimTokenHash: row.claimTokenHash,
    ownerId: row.ownerId,
    visibility: row.visibility,
    hidden: row.hidden,
    plays: row.plays,
    likes: row.likes,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    expiresAt: row.expiresAt?.getTime() ?? null,
  }
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
// folder would corrupt it. Lessons and accounts share the connection.
const shared = globalThis as {
  learnDb?: Promise<Db>
  lessonStore?: Promise<LessonStore>
}

export function getDb(): Promise<Db> {
  if (!shared.learnDb) {
    const pending = connect()
    // A failed connection isn't kept, so the next request tries again.
    pending.catch(() => {
      if (shared.learnDb === pending) shared.learnDb = undefined
    })
    shared.learnDb = pending
  }
  return shared.learnDb
}

export function getLessonStore(): Promise<LessonStore> {
  if (!shared.lessonStore) {
    const pending = getDb().then((db) => new PostgresLessonStore(db))
    pending.catch(() => {
      if (shared.lessonStore === pending) shared.lessonStore = undefined
    })
    shared.lessonStore = pending
  }
  return shared.lessonStore
}
