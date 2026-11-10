import { readFileSync } from "node:fs"

import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  activityDay,
  connectPglite,
  lesson,
  user,
  type Db,
} from "@workspace/db"

import type { Actor } from "@/lib/auth/actor"
import { publishLesson, type Deps } from "@/lib/publish/handlers"
import { MemoryRateLimiter } from "@/lib/publish/rate-limit"
import { PostgresLessonStore } from "@/lib/publish/store"

import {
  accountDays,
  decodeCursor,
  exploreFeed,
  FEED_PAGE_SIZE,
  profileFeed,
  type AppApiDeps,
  type ProfileReply,
} from "./app-api"
import { completeLesson, likeLesson, recordProgress } from "./handlers"
import type { LessonSummary } from "./queries"
import { MemoryViewCounter } from "./views"

// The iOS app's JSON for Explore and profiles, over an in-memory Postgres: paging, what the viewer
// liked and finished, and who sees which lessons.

const buttons = readFileSync(
  new URL("../../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

let db: Db
let publish: Deps
let deps: AppApiDeps
let views: MemoryViewCounter
const DAY = 24 * 3.6e6
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
  views = new MemoryViewCounter()
  deps = {
    db,
    views,
    limiter: new MemoryRateLimiter(1000),
    now: () => now,
  }
  await db.delete(lesson)
  await db.delete(activityDay)
})

/** Publishes a lesson for `ownerId`, listed unless said otherwise; each one a second after the last. */
async function published(
  ownerId: string,
  options: { visibility?: "public" | "unlisted"; hidden?: boolean } = {}
): Promise<string> {
  now += 1000
  const reply = await publishLesson(
    { text: buttons, client: "x", ownerId },
    publish
  )
  const id = reply.body.id as string
  await db
    .update(lesson)
    .set({
      visibility: options.visibility ?? "public",
      hidden: options.hidden ?? false,
    })
    .where(eq(lesson.id, id))
  return id
}

/** What the like, finish, and progress handlers need, to set up what a viewer did. */
const exploreDeps = () => ({
  db,
  views,
  limiter: new MemoryRateLimiter(1000),
  sendReport: async () => {},
  origin: "https://learn.test",
  now: () => now,
})

describe("the app's Explore feed", () => {
  it("pages through the listed lessons, newest first, with a cursor", async () => {
    const ids: string[] = []
    for (let i = 0; i < FEED_PAGE_SIZE + 5; i++)
      ids.push(await published("ada"))
    await published("ada", { visibility: "unlisted" })
    await published("ada", { hidden: true })
    const first = await exploreFeed(
      { actor: null, cursor: null, client: "c" },
      deps
    )
    expect(first.status).toBe(200)
    const one = first.body as { lessons: LessonSummary[]; next: string | null }
    expect(one.lessons).toHaveLength(FEED_PAGE_SIZE)
    expect(one.lessons[0]!.id).toBe(ids.at(-1))
    expect(one.next).not.toBeNull()
    const second = await exploreFeed(
      { actor: null, cursor: one.next, client: "c" },
      deps
    )
    const two = second.body as { lessons: LessonSummary[]; next: string | null }
    expect(two.lessons.map((l) => l.id)).toEqual(ids.slice(0, 5).reverse())
    expect(two.next).toBeNull()
  })

  it("says what a signed-in viewer liked and finished, and nothing for a visitor", async () => {
    const liked = await published("ada")
    const finished = await published("ada")
    await likeLesson({ id: liked, userId: "bob" }, exploreDeps())
    await completeLesson({ id: finished, userId: "bob" }, exploreDeps())
    await views.record(liked)
    const signedIn = await exploreFeed(
      { actor: bob, cursor: null, client: "c" },
      deps
    )
    expect(signedIn.body.viewer).toEqual({
      signedIn: true,
      liked: [liked],
      completed: { [finished]: now },
    })
    const lessons = signedIn.body.lessons as LessonSummary[]
    // A view still pending counts already, as on the page.
    expect(lessons.find((l) => l.id === liked)!.views).toBe(1)
    const visitor = await exploreFeed(
      { actor: null, cursor: null, client: "c" },
      deps
    )
    expect(visitor.body.viewer).toEqual({
      signedIn: false,
      liked: [],
      completed: {},
    })
  })

  it("ignores a cursor that isn't one, and keeps to the read limit", async () => {
    expect(decodeCursor("12.abc")).toEqual({ createdAt: 12, id: "abc" })
    expect(decodeCursor("nope")).toBeNull()
    expect(decodeCursor("1.a;drop")).toBeNull()
    await published("ada")
    const limited = { ...deps, limiter: new MemoryRateLimiter(1) }
    const req = { actor: null, cursor: "nope", client: "c" }
    expect((await exploreFeed(req, limited)).status).toBe(200)
    expect((await exploreFeed(req, limited)).status).toBe(429)
  })
})

describe("the app's profiles", () => {
  it("shows visitors the listed lessons, with no In progress tab", async () => {
    const listed = await published("ada")
    await published("ada", { visibility: "unlisted" })
    await published("ada", { hidden: true })
    for (const viewer of [null, bob]) {
      const reply = await profileFeed(
        { handle: "ada", actor: viewer, tz: null, client: "c" },
        deps
      )
      expect(reply.status).toBe(200)
      const body = reply.body as unknown as ProfileReply
      expect(body.own).toBe(false)
      expect(body.lessons.map((l) => l.id)).toEqual([listed])
      expect(body.inProgress).toBeNull()
      expect(body.viewer.signedIn).toBe(viewer !== null)
    }
  })

  it("shows the person everything they own, what they left midway, and their streak", async () => {
    const listed = await published("ada")
    const unlisted = await published("ada", { visibility: "unlisted" })
    const midway = await published("bob")
    await recordProgress(
      { id: midway, userId: "ada", done: 2, total: 5 },
      exploreDeps()
    )
    await completeLesson(
      { id: listed, userId: "ada", tz: "UTC" },
      exploreDeps()
    )
    now += DAY
    await completeLesson(
      { id: unlisted, userId: "ada", tz: "UTC" },
      exploreDeps()
    )
    const reply = await profileFeed(
      { handle: "ADA", actor: ada, tz: "Europe/Rome", client: "c" },
      deps
    )
    const body = reply.body as unknown as ProfileReply
    expect(body.own).toBe(true)
    expect(body.lessons.map((l) => l.id).sort()).toEqual(
      [listed, unlisted].sort()
    )
    expect(body.inProgress).toEqual([
      expect.objectContaining({ id: midway, progress: { done: 2, total: 5 } }),
    ])
    expect(body.grid.total).toBe(2)
    expect(body.grid.streak).toEqual({ current: 2, longest: 2 })
    expect(Object.keys(body.viewer.completed).sort()).toEqual(
      [listed, unlisted].sort()
    )
  })

  it("lists liked lessons, leaving out unlisted ones for visitors", async () => {
    const shown = await published("bob")
    const unlisted = await published("bob", { visibility: "unlisted" })
    await likeLesson({ id: shown, userId: "ada" }, exploreDeps())
    await likeLesson({ id: unlisted, userId: "ada" }, exploreDeps())
    const visitor = await profileFeed(
      { handle: "ada", actor: null, tz: null, client: "c" },
      deps
    )
    expect(
      (visitor.body as unknown as ProfileReply).likes.map((l) => l.id)
    ).toEqual([shown])
    const own = await profileFeed(
      { handle: "ada", actor: ada, tz: null, client: "c" },
      deps
    )
    expect(
      (own.body as unknown as ProfileReply).likes.map((l) => l.id).sort()
    ).toEqual([shown, unlisted].sort())
  })

  it("answers 404 for a handle nobody has", async () => {
    for (const handle of ["nobody", "", "!!"]) {
      const reply = await profileFeed(
        { handle, actor: null, tz: null, client: "c" },
        deps
      )
      expect(reply.status).toBe(404)
    }
  })
})

describe("the app's account days", () => {
  it("lists the days the learner finished a lesson, in the time zone each counted in", async () => {
    const first = await published("bob")
    const second = await published("bob")
    // 1_800_000_000_000 is 2027-01-15 08:00 UTC: still the 14th in Honolulu.
    await completeLesson(
      { id: first, userId: "ada", tz: "Pacific/Honolulu" },
      exploreDeps()
    )
    now += 2 * DAY
    await completeLesson({ id: second, userId: "ada", tz: "UTC" }, exploreDeps())
    await completeLesson({ id: first, userId: "bob", tz: "UTC" }, exploreDeps())
    const reply = await accountDays({ actor: ada }, deps)
    expect(reply).toEqual({
      status: 200,
      body: { ok: true, days: ["2027-01-14", "2027-01-17"] },
    })
  })

  it("has none for a learner who hasn't finished one", async () => {
    const reply = await accountDays({ actor: ada }, deps)
    expect(reply.body).toEqual({ ok: true, days: [] })
  })
})
