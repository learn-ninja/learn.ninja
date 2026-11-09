import { readFileSync } from "node:fs"

import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { block, connectPglite, lesson, user, type Db } from "@workspace/db"

import type { Actor } from "@/lib/auth/actor"
import { publishLesson, type Deps } from "@/lib/publish/handlers"
import { MemoryRateLimiter } from "@/lib/publish/rate-limit"
import { readLesson } from "@/lib/publish/read"
import { PostgresLessonStore } from "@/lib/publish/store"

import {
  exploreFeed,
  profileFeed,
  type AppApiDeps,
  type ProfileReply,
} from "./app-api"
import { blockUser, listBlocks, unblockUser } from "./blocks"
import { likeLesson } from "./handlers"
import {
  authorOf,
  blockedIds,
  hasBlocked,
  listLessons,
  type BlockedPerson,
  type LessonSummary,
} from "./queries"
import { MemoryViewCounter } from "./views"

// Blocking someone (App Store guideline 1.2): the endpoints, and the blocked person's lessons
// leaving the blocker's Explore, the Likes tabs they read, and the blocked person's profile, over
// an in-memory Postgres.

const buttons = readFileSync(
  new URL("../../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

let db: Db
let publish: Deps
let deps: AppApiDeps
let now = 1_800_000_000_000

const actor = (id: string): Actor => ({
  userId: id,
  email: `${id}@example.com`,
  name: id,
  handle: id,
  image: null,
  viaApiKey: false,
})
const ada = actor("ada")
const bob = actor("bob")

beforeAll(async () => {
  db = await connectPglite()
  await db.insert(user).values([
    { id: "ada", name: "Ada", email: "ada@example.com", handle: "ada" },
    { id: "bob", name: "Bob", email: "bob@example.com", handle: "bob" },
    { id: "cy", name: "Cy", email: "cy@example.com", handle: "cy" },
  ])
}, 30_000)

beforeEach(async () => {
  now = 1_800_000_000_000
  publish = {
    store: new PostgresLessonStore(db, () => now),
    limiter: new MemoryRateLimiter(1000),
    origin: "https://learn.test",
    now: () => now,
  }
  deps = {
    db,
    views: new MemoryViewCounter(),
    limiter: new MemoryRateLimiter(1000),
    now: () => now,
  }
  await db.delete(lesson)
  await db.delete(block)
})

/** A listed lesson by `ownerId`, a second after the last. */
async function published(ownerId: string): Promise<string> {
  now += 1000
  const reply = await publishLesson(
    { text: buttons, client: "x", ownerId },
    publish
  )
  const id = reply.body.id as string
  await db.update(lesson).set({ visibility: "public" }).where(eq(lesson.id, id))
  return id
}

const ids = (lessons: LessonSummary[]) => lessons.map((l) => l.id)

describe("the block endpoints", () => {
  it("blocks someone, lists them, and unblocks them", async () => {
    const reply = await blockUser({ userId: "ada", target: "bob" }, db, now)
    expect(reply).toEqual({
      status: 200,
      body: { ok: true, userId: "bob", blocked: true },
    })
    // Twice is fine.
    expect((await blockUser({ userId: "ada", target: "bob" }, db)).status).toBe(
      200
    )
    expect(await hasBlocked(db, "ada", "bob")).toBe(true)
    // One way only.
    expect(await hasBlocked(db, "bob", "ada")).toBe(false)
    const list = await listBlocks("ada", db)
    expect(list.body.blocked as BlockedPerson[]).toEqual([
      { id: "bob", handle: "bob", name: "Bob", image: null, blockedAt: now },
    ])
    expect((await listBlocks("bob", db)).body.blocked).toEqual([])
    const undone = await unblockUser({ userId: "ada", target: "bob" }, db)
    expect(undone.body).toEqual({ ok: true, userId: "bob", blocked: false })
    expect(await blockedIds(db, "ada")).toEqual(new Set())
    // Unblocking someone who isn't blocked is fine too.
    expect(
      (await unblockUser({ userId: "ada", target: "cy" }, db)).status
    ).toBe(200)
  })

  it("refuses yourself, nobody, and someone who doesn't exist", async () => {
    for (const target of ["ada", "", undefined, 42]) {
      const reply = await blockUser({ userId: "ada", target }, db)
      expect(reply.status).toBe(400)
    }
    expect((await blockUser({ userId: "ada", target: "zed" }, db)).status).toBe(
      404
    )
    expect(await blockedIds(db, "ada")).toEqual(new Set())
  })

  it("goes when either account is deleted", async () => {
    await db
      .insert(user)
      .values({ id: "dee", name: "Dee", email: "dee@example.com" })
    await blockUser({ userId: "ada", target: "dee" }, db)
    await db.delete(user).where(eq(user.id, "dee"))
    expect(await blockedIds(db, "ada")).toEqual(new Set())
  })
})

describe("what a blocker no longer sees", () => {
  it("leaves the blocked person's lessons out of Explore, for the blocker only", async () => {
    const bobs = await published("bob")
    const cys = await published("cy")
    await blockUser({ userId: "ada", target: "bob" }, db)
    expect(
      ids(await listLessons(db, "new", 10, { now, viewerId: "ada" }))
    ).toEqual([cys])
    expect(ids(await listLessons(db, "new", 10, { now }))).toEqual([cys, bobs])
    const feed = (who: Actor | null) =>
      exploreFeed({ actor: who, cursor: null, client: "c" }, deps).then((r) =>
        ids(r.body.lessons as LessonSummary[])
      )
    expect(await feed(ada)).toEqual([cys])
    expect(await feed(bob)).toEqual([cys, bobs])
    expect(await feed(null)).toEqual([cys, bobs])
    await unblockUser({ userId: "ada", target: "bob" }, db)
    expect(await feed(ada)).toEqual([cys, bobs])
  })

  it("shows the blocker an empty profile, marked blocked", async () => {
    const bobs = await published("bob")
    const cys = await published("cy")
    await likeLesson(
      { id: cys, userId: "bob" },
      {
        db,
        views: deps.views,
        limiter: new MemoryRateLimiter(1000),
        sendReport: async () => {},
        origin: "https://learn.test",
      }
    )
    await blockUser({ userId: "ada", target: "bob" }, db)
    const profile = async (who: Actor | null) =>
      (
        await profileFeed(
          { handle: "bob", actor: who, tz: null, client: "c" },
          deps
        )
      ).body as unknown as ProfileReply
    const blocked = await profile(ada)
    expect(blocked.blocked).toBe(true)
    expect(blocked.lessons).toEqual([])
    expect(blocked.likes).toEqual([])
    const visitor = await profile(null)
    expect(visitor.blocked).toBe(false)
    expect(ids(visitor.lessons)).toEqual([bobs])
    expect(ids(visitor.likes)).toEqual([cys])
    // Their own profile is never blocked for them.
    expect((await profile(bob)).blocked).toBe(false)
  })

  it("leaves the blocked person's lessons out of the Likes tabs the blocker reads", async () => {
    const bobs = await published("bob")
    const cys = await published("cy")
    const exploreDeps = {
      db,
      views: deps.views,
      limiter: new MemoryRateLimiter(1000),
      sendReport: async () => {},
      origin: "https://learn.test",
    }
    await likeLesson({ id: bobs, userId: "cy" }, exploreDeps)
    await likeLesson({ id: bobs, userId: "ada" }, exploreDeps)
    await likeLesson({ id: cys, userId: "ada" }, exploreDeps)
    await blockUser({ userId: "ada", target: "bob" }, db)
    const likes = async (handle: string, who: Actor | null) =>
      ids(
        (
          (
            await profileFeed(
              { handle, actor: who, tz: null, client: "c" },
              deps
            )
          ).body as unknown as ProfileReply
        ).likes
      )
    expect(await likes("cy", ada)).toEqual([])
    expect(await likes("cy", null)).toEqual([bobs])
    // Their own Likes tab too.
    expect(await likes("ada", ada)).toEqual([cys])
  })
})

describe("the lesson's JSON", () => {
  it("names who kept it, for the app's Report and Block", async () => {
    const id = await published("bob")
    const reply = await readLesson(
      { param: id, client: "c" },
      {
        store: publish.store,
        limiter: new MemoryRateLimiter(1000),
        visualsCssUrl: "/lesson-visuals.css",
        bundled: async () => null,
        handleOf: async (ownerId) =>
          (await authorOf(db, ownerId))?.handle ?? null,
      }
    )
    expect(reply.body).toMatchObject({
      author: { id: "bob", handle: "bob" },
      listed: true,
    })
  })
})
