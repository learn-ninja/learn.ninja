import { readFileSync } from "node:fs"

import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  connectPglite,
  lesson,
  lessonTag,
  report,
  user,
  type Db,
} from "@workspace/db"

import { publishLesson, updateLesson, type Deps } from "@/lib/publish/handlers"
import { MemoryRateLimiter } from "@/lib/publish/rate-limit"
import { PostgresLessonStore } from "@/lib/publish/store"

import {
  flushPendingPlays,
  completeLesson,
  deleteLesson,
  likeLesson,
  recordPlay,
  renameLesson,
  reportLesson,
  setVisibility,
  unlikeLesson,
  type ExploreDeps,
} from "./handlers"
import { MemoryPlayCounter, WriteThroughPlayCounter } from "./plays"
import {
  authorOf,
  completedAt,
  lessonsLikedBy,
  lessonsOwnedBy,
  likedIds,
  listLessons,
  profileByHandle,
  trendingScore,
} from "./queries"
import { reportText, type ReportMail } from "./report-email"
import { backfillTags, formatBackfill } from "./backfill"
import { formatTagReport, tagReport } from "./tag-report"

// Explore over an in-memory Postgres: what gets listed, how the tabs sort, likes, visibility,
// completions, reports, and plays.

const example = (file: string) =>
  readFileSync(new URL(`../../../../examples/${file}`, import.meta.url), "utf8")
const buttons = example("button-hierarchy.json")
const spanish = example("spanish-greetings.json")

let db: Db
let publish: Deps
let deps: ExploreDeps
let sent: ReportMail[]
const DAY = 24 * 3.6e6
let now = 1_800_000_000_000

beforeAll(async () => {
  db = await connectPglite()
  await db.insert(user).values([
    {
      id: "ada",
      name: "Ada Lovelace",
      email: "ada@example.com",
      handle: "ada",
    },
    { id: "bob", name: "Bob", email: "bob@example.com", handle: "bob" },
    { id: "new", name: "No Handle Yet", email: "new@example.com" },
  ])
}, 30_000)

beforeEach(async () => {
  now = 1_800_000_000_000
  sent = []
  publish = {
    store: new PostgresLessonStore(db, () => now),
    limiter: new MemoryRateLimiter(1000),
    origin: "https://learn.test",
    now: () => now,
  }
  deps = {
    db,
    plays: new WriteThroughPlayCounter(db),
    limiter: new MemoryRateLimiter(1000),
    sendReport: async (r) => {
      sent.push(r)
    },
    origin: "https://learn.test",
    now: () => now,
  }
  // Each test starts from an empty table; users stay.
  await db.delete(lesson)
})

/** Publishes `text` for `ownerId` (anonymous when null) and returns the lesson id. */
async function published(
  ownerId: string | null,
  options: {
    text?: string
    visibility?: "public" | "unlisted"
    hidden?: boolean
    plays?: number
    likes?: number
  } = {}
): Promise<string> {
  const reply = await publishLesson(
    { text: options.text ?? buttons, client: "x", ownerId },
    publish
  )
  expect(reply.status).toBe(201)
  const id = reply.body.id as string
  await db
    .update(lesson)
    .set({
      visibility: options.visibility ?? "unlisted",
      hidden: options.hidden ?? false,
      plays: options.plays ?? 0,
      likes: options.likes ?? 0,
    })
    .where(eq(lesson.id, id))
  return id
}

describe("what Explore lists", () => {
  it("shows owned, public, unhidden lessons only, as cards", async () => {
    const shown = await published("ada", { visibility: "public" })
    await published(null, { visibility: "public" }) // anonymous: never, whatever the column says
    await published("ada") // unlisted
    await published("bob", { visibility: "public", hidden: true })
    const rows = await listLessons(db, "new", 10, { now })
    expect(rows.map((r) => r.id)).toEqual([shown])
    expect(rows[0]).toMatchObject({
      slug: "button-hierarchy",
      title: "Button hierarchy",
      subject: "design",
      level: "beginner",
      minutes: 6,
      language: "en",
      author: {
        id: "ada",
        handle: "ada",
        name: "Ada Lovelace",
        image: null,
      },
      plays: 0,
      likes: 0,
      visibility: "public",
      hidden: false,
      createdAt: now,
    })
    expect(rows[0]!.summary).toBeTruthy()
  })

  it("sorts New by date, Top by likes then plays, and Trending by a decaying score", async () => {
    const old = await published("ada", {
      visibility: "public",
      plays: 100,
      likes: 10,
    })
    now += 2 * DAY
    const middle = await published("ada", {
      visibility: "public",
      plays: 40,
      likes: 5,
    })
    now += 2 * DAY
    const fresh = await published("bob", {
      visibility: "public",
      plays: 10,
      likes: 1,
    })
    const ids = async (sort: "new" | "top" | "trending") =>
      (await listLessons(db, sort, 10, { now })).map((r) => r.id)
    expect(await ids("new")).toEqual([fresh, middle, old])
    expect(await ids("top")).toEqual([old, middle, fresh])
    // Scores: old 130 halved twice = 32.5; middle 55 halved once = 27.5; fresh 13.
    expect(
      trendingScore({ plays: 100, likes: 10, createdAt: now - 4 * DAY }, now)
    ).toBeCloseTo(32.5)
    expect(
      trendingScore({ plays: 40, likes: 5, createdAt: now - 2 * DAY }, now)
    ).toBeCloseTo(27.5)
    expect(await ids("trending")).toEqual([old, middle, fresh])
    // Two days on, the old one has halved again (16.25) and the fresh one (13 → 6.5) still trails.
    now += 2 * DAY
    expect(await ids("trending")).toEqual([old, middle, fresh])
    // A burst of plays on the fresh one takes it to the top.
    await db.update(lesson).set({ plays: 200 }).where(eq(lesson.id, fresh))
    expect(await ids("trending")).toEqual([fresh, old, middle])
  })

  it("respects the limit", async () => {
    for (let i = 0; i < 3; i++) await published("ada", { visibility: "public" })
    expect(await listLessons(db, "new", 2, { now })).toHaveLength(2)
  })

  it("lists a lesson whose owner has no handle yet, without a handle", async () => {
    await published("new", { visibility: "public" })
    const [row] = await listLessons(db, "new", 10, { now })
    expect(row?.author).toEqual({
      id: "new",
      handle: null,
      name: "No Handle Yet",
      image: null,
    })
  })
})

describe("profiles", () => {
  it("shows a person's listed lessons with totals", async () => {
    const a = await published("ada", {
      visibility: "public",
      plays: 7,
      likes: 2,
    })
    now += 1000
    const b = await published("ada", {
      visibility: "public",
      text: spanish,
      plays: 3,
      likes: 1,
    })
    await published("ada") // unlisted: not shown
    await published("ada", { visibility: "public", hidden: true })
    await published("bob", { visibility: "public" })
    const profile = await profileByHandle(db, "ada", now)
    expect(profile).toMatchObject({
      id: "ada",
      handle: "ada",
      name: "Ada Lovelace",
      plays: 10,
      likes: 3,
    })
    expect(profile?.lessons.map((l) => l.id)).toEqual([b, a])
    expect(await profileByHandle(db, "nobody", now)).toBeNull()
  })

  it("lists everything an owner has for their own profile, and names the author", async () => {
    const a = await published("ada", { visibility: "public" })
    const b = await published("ada", { hidden: true })
    await published("bob")
    expect((await lessonsOwnedBy(db, "ada")).map((l) => l.id).sort()).toEqual(
      [a, b].sort()
    )
    expect(await authorOf(db, "ada")).toEqual({
      handle: "ada",
      name: "Ada Lovelace",
      image: null,
    })
    expect(await authorOf(db, "ghost")).toBeNull()
  })
})

describe("likes", () => {
  it("counts one like per user, and takes it back", async () => {
    const id = await published("ada", { visibility: "public" })
    let changes = 0
    deps.onChange = () => changes++
    expect(await likeLesson({ id, userId: "bob" }, deps)).toMatchObject({
      status: 200,
      body: { ok: true, liked: true, likes: 1 },
    })
    // Liking again changes nothing.
    expect(await likeLesson({ id, userId: "bob" }, deps)).toMatchObject({
      body: { liked: true, likes: 1 },
    })
    expect(await likeLesson({ id, userId: "ada" }, deps)).toMatchObject({
      body: { likes: 2 },
    })
    expect(await likedIds(db, "bob", [id, "other"])).toEqual(new Set([id]))
    expect(await likedIds(db, "new", [id])).toEqual(new Set())
    expect(await unlikeLesson({ id, userId: "bob" }, deps)).toMatchObject({
      body: { ok: true, liked: false, likes: 1 },
    })
    expect(await unlikeLesson({ id, userId: "bob" }, deps)).toMatchObject({
      body: { liked: false, likes: 1 },
    })
    expect(changes).toBe(3)
    expect((await listLessons(db, "top", 1, { now }))[0]?.likes).toBe(1)
  })

  it("lists what a user liked, latest first, leaving out hidden lessons and, for visitors, unlisted ones", async () => {
    const a = await published("ada", { visibility: "public" })
    const b = await published("ada")
    const c = await published("ada", { visibility: "public" })
    for (const id of [a, b, c]) await likeLesson({ id, userId: "bob" }, deps)
    await db.update(lesson).set({ hidden: true }).where(eq(lesson.id, c))
    expect((await lessonsLikedBy(db, "bob", { now })).map((l) => l.id)).toEqual(
      [b, a]
    )
    expect(
      (await lessonsLikedBy(db, "bob", { listedOnly: true, now })).map(
        (l) => l.id
      )
    ).toEqual([a])
    expect(await lessonsLikedBy(db, "ghost", { now })).toEqual([])
  })

  it("answers 404 for a lesson that's gone", async () => {
    expect(
      await likeLesson({ id: "nope1234", userId: "bob" }, deps)
    ).toMatchObject({
      status: 404,
      body: { error: "not_found" },
    })
  })
})

describe("completions", () => {
  it("keeps when each user first finished a lesson", async () => {
    const id = await published("ada", { visibility: "public" })
    const first = now
    expect(await completeLesson({ id, userId: "bob" }, deps)).toMatchObject({
      status: 200,
      body: { ok: true, completedAt: new Date(first).toISOString() },
    })
    // Finishing again keeps the first time.
    now += DAY
    expect(await completeLesson({ id, userId: "bob" }, deps)).toMatchObject({
      body: { completedAt: new Date(first).toISOString() },
    })
    expect(await completedAt(db, "bob", [id, "other"])).toEqual(
      new Map([[id, first]])
    )
    expect(await completedAt(db, "ada", [id])).toEqual(new Map())
  })

  it("answers 404 for a lesson that's gone", async () => {
    expect(
      await completeLesson({ id: "nope1234", userId: "bob" }, deps)
    ).toMatchObject({ status: 404, body: { error: "not_found" } })
  })
})

describe("visibility", () => {
  it("lets the owner, and only the owner, list a lesson", async () => {
    const id = await published("ada")
    expect(
      await setVisibility({ id, userId: "bob", visibility: "public" }, deps)
    ).toMatchObject({ status: 403, body: { error: "not_owner" } })
    expect(await listLessons(db, "new", 10, { now })).toEqual([])
    expect(
      await setVisibility({ id, userId: "ada", visibility: "public" }, deps)
    ).toMatchObject({
      status: 200,
      body: {
        ok: true,
        id,
        url: `https://learn.test/l/button-hierarchy-${id}`,
        visibility: "public",
      },
    })
    expect(
      (await listLessons(db, "new", 10, { now })).map((l) => l.id)
    ).toEqual([id])
    expect(
      await setVisibility({ id, userId: "ada", visibility: "unlisted" }, deps)
    ).toMatchObject({ body: { visibility: "unlisted" } })
    expect(await listLessons(db, "new", 10, { now })).toEqual([])
  })

  it("refuses team visibility and nonsense", async () => {
    const id = await published("ada")
    expect(
      await setVisibility({ id, userId: "ada", visibility: "team" }, deps)
    ).toMatchObject({ status: 422, body: { error: "invalid_visibility" } })
    expect(
      await setVisibility({ id, userId: "ada", visibility: 42 }, deps)
    ).toMatchObject({ status: 422 })
  })

  it("an anonymous lesson has no owner to list it", async () => {
    const id = await published(null)
    expect(
      await setVisibility({ id, userId: "ada", visibility: "public" }, deps)
    ).toMatchObject({ status: 403 })
  })
})

describe("renaming and deleting", () => {
  it("lets the owner, and only the owner, rename a lesson", async () => {
    const id = await published("ada", { visibility: "public" })
    expect(
      await renameLesson({ id, userId: "bob", title: "Mine now" }, deps)
    ).toMatchObject({ status: 403, body: { error: "not_owner" } })
    expect(
      await renameLesson(
        { id, userId: "ada", title: "  Buttons,   ranked " },
        deps
      )
    ).toMatchObject({
      status: 200,
      body: {
        title: "Buttons, ranked",
        url: `https://learn.test/l/button-hierarchy-${id}`,
      },
    })
    const [listed] = await listLessons(db, "new", 10, { now })
    expect(listed?.title).toBe("Buttons, ranked")
    const [row] = await db
      .select({ lesson: lesson.lesson })
      .from(lesson)
      .where(eq(lesson.id, id))
    expect((row?.lesson as { title: string }).title).toBe("Buttons, ranked")
  })

  it("refuses an empty or overlong title", async () => {
    const id = await published("ada")
    for (const title of ["   ", "x".repeat(61), 42]) {
      expect(
        await renameLesson({ id, userId: "ada", title }, deps)
      ).toMatchObject({ status: 422, body: { error: "invalid_title" } })
    }
  })

  it("lets the owner, and only the owner, delete a lesson and what hangs off it", async () => {
    const id = await published("ada", { visibility: "public" })
    await likeLesson({ id, userId: "bob" }, deps)
    expect(await deleteLesson({ id, userId: "bob" }, deps)).toMatchObject({
      status: 403,
    })
    expect(await deleteLesson({ id, userId: "ada" }, deps)).toMatchObject({
      status: 200,
      body: { deleted: true },
    })
    expect(await listLessons(db, "new", 10, { now })).toEqual([])
    expect(await likedIds(db, "bob", [id])).toEqual(new Set())
    expect(await deleteLesson({ id, userId: "ada" }, deps)).toMatchObject({
      status: 404,
    })
  })
})

describe("reports", () => {
  it("keeps the report with a hashed address and emails the maker once per reporter", async () => {
    const id = await published("ada", { visibility: "public" })
    const reply = await reportLesson(
      { id, reason: "  It's spam.  ", client: "203.0.113.9" },
      deps
    )
    expect(reply).toMatchObject({ status: 201, body: { ok: true } })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      lessonId: id,
      title: "Button hierarchy",
      url: `https://learn.test/l/button-hierarchy-${id}`,
      reason: "It's spam.",
    })
    expect(sent[0]!.reporterIpHash).not.toContain("203.0.113.9")
    const rows = await db.select().from(report).where(eq(report.lessonId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.reporterIpHash).toBe(sent[0]!.reporterIpHash)
    // The same place again: kept, but no second email.
    await reportLesson(
      { id, reason: "Still spam.", client: "203.0.113.9" },
      deps
    )
    expect(sent).toHaveLength(1)
    expect(
      await db.select().from(report).where(eq(report.lessonId, id))
    ).toHaveLength(2)
    // Someone else: emailed.
    await reportLesson({ id, reason: "Agreed.", client: "198.51.100.2" }, deps)
    expect(sent).toHaveLength(2)
    const text = reportText(sent[0]!)
    expect(text).toContain(
      `UPDATE lesson SET hidden = true WHERE id = '${id}';`
    )
    expect(text).toContain("It's spam.")
  })

  it("needs a reason, a live lesson, and not too many reports", async () => {
    const id = await published("ada", { visibility: "public" })
    expect(
      await reportLesson({ id, reason: "", client: "x" }, deps)
    ).toMatchObject({
      status: 400,
      body: { error: "bad_request" },
    })
    expect(
      await reportLesson({ id, reason: "x".repeat(1001), client: "x" }, deps)
    ).toMatchObject({ status: 400 })
    expect(
      await reportLesson({ id: "nope1234", reason: "Spam", client: "x" }, deps)
    ).toMatchObject({ status: 404 })
    deps.limiter = new MemoryRateLimiter(1)
    expect(
      (await reportLesson({ id, reason: "Spam", client: "y" }, deps)).status
    ).toBe(201)
    expect(
      await reportLesson({ id, reason: "Spam", client: "y" }, deps)
    ).toMatchObject({
      status: 429,
      body: { error: "rate_limited" },
    })
    expect(sent).toHaveLength(1)
  })
})

describe("plays", () => {
  it("writes straight through without Redis", async () => {
    const id = await published("ada", { visibility: "public" })
    await recordPlay(id, deps)
    await recordPlay(id, deps)
    await recordPlay("nope1234", deps) // an unknown id changes nothing
    expect((await listLessons(db, "new", 1, { now }))[0]?.plays).toBe(2)
    expect(await flushPendingPlays(deps)).toBe(0)
  })

  it("adds a batch of pending plays to the table in one flush", async () => {
    const a = await published("ada", { visibility: "public", plays: 5 })
    const b = await published("bob", { visibility: "public" })
    const counter = new MemoryPlayCounter()
    const batched = { ...deps, plays: counter }
    await recordPlay(a, batched)
    await recordPlay(a, batched)
    await recordPlay(b, batched)
    // Nothing in the table yet.
    expect(
      (await listLessons(db, "top", 10, { now })).map((l) => l.plays)
    ).toEqual([5, 0])
    expect(await flushPendingPlays(batched)).toBe(3)
    expect(await flushPendingPlays(batched)).toBe(0)
    const rows = await listLessons(db, "top", 10, { now })
    expect(rows.find((l) => l.id === a)?.plays).toBe(7)
    expect(rows.find((l) => l.id === b)?.plays).toBe(1)
  })
})

describe("subjects and tags", () => {
  /** The buttons example with other tags, or the Spanish one for a second subject. */
  const withTags = (text: string, tags: string[]) =>
    JSON.stringify({ ...JSON.parse(text), tags })

  it("narrows the list to a subject, a tag, or both", async () => {
    // A minute apart, so the "new" order is fixed.
    const design = await published("ada", { visibility: "public" })
    now += 60_000
    const forms = await published("ada", {
      visibility: "public",
      text: withTags(buttons, ["forms", "buttons"]),
    })
    now += 60_000
    const spanishId = await published("bob", {
      visibility: "public",
      text: spanish,
    })
    // Unlisted lessons stay out, whatever their subject.
    await published("ada", { text: withTags(buttons, ["forms"]) })
    const ids = async (filter: Parameters<typeof listLessons>[3]) =>
      (await listLessons(db, "new", 10, { ...filter, now })).map((l) => l.id)
    expect(await ids({})).toEqual([spanishId, forms, design])
    expect(await ids({ subject: "design" })).toEqual([forms, design])
    expect(await ids({ subject: "languages" })).toEqual([spanishId])
    expect(await ids({ subject: "history" })).toEqual([])
    expect(await ids({ tag: "buttons" })).toEqual([forms, design])
    expect(await ids({ tag: "forms" })).toEqual([forms])
    expect(await ids({ subject: "design", tag: "greetings" })).toEqual([])
    expect(await ids({ subject: "languages", tag: "greetings" })).toEqual([
      spanishId,
    ])
  })

  it("lists an older lesson under the subject its topic maps to", async () => {
    const { subject: _subject, tags: _tags, ...rest } = JSON.parse(buttons)
    const id = await published("ada", {
      visibility: "public",
      text: JSON.stringify({ ...rest, spec: "0.5", topic: "Startups" }),
    })
    const [row] = await listLessons(db, "new", 10, { now })
    expect(row).toMatchObject({ id, subject: "business", tags: ["Startups"] })
    // The stored JSON was upgraded, so the subject index and the tag table see it too.
    expect(
      (await listLessons(db, "new", 10, { subject: "business", now })).map(
        (l) => l.id
      )
    ).toEqual([id])
    expect(
      (await listLessons(db, "new", 10, { tag: "startups", now })).map(
        (l) => l.id
      )
    ).toEqual([id])
  })

  it("shows a 0.7 lesson's slug tags as labels on its row without rewriting it", async () => {
    // Stored as spec 0.7 wrote it: slug tags. The row and the lesson page upgrade on read.
    await db.insert(lesson).values({
      id: "cc000001",
      slug: "claude-code-basics",
      spec: "0.7",
      lesson: {
        ...JSON.parse(buttons),
        spec: "0.7",
        subject: "tools",
        tags: ["claude-code", "remote-work"],
      },
      prepared: {},
      editTokenHash: "x",
      ownerId: "ada",
      visibility: "public",
    })
    const [row] = await listLessons(db, "new", 10, { now })
    expect(row).toMatchObject({
      id: "cc000001",
      subject: "tools",
      tags: ["Claude Code", "Remote work"],
    })
  })

  it("reports subjects by lesson count, the top tags in each, and tags used once", async () => {
    await published("ada", { visibility: "public" })
    await published("ada", {
      visibility: "public",
      text: withTags(buttons, ["Buttons", "Forms"]),
    })
    await published("bob", { visibility: "public", text: spanish })
    await published("bob", { text: withTags(buttons, ["Ignored"]) })
    const report = await tagReport(db, { now, top: 2 })
    expect(report.lessons).toBe(3)
    expect(report.subjects.slice(0, 2)).toEqual([
      {
        subject: "design",
        lessons: 2,
        tags: [
          { tag: "buttons", label: "Buttons", lessons: 2 },
          { tag: "forms", label: "Forms", lessons: 1 },
        ],
      },
      {
        subject: "languages",
        lessons: 1,
        tags: [
          { tag: "greetings", label: "Greetings", lessons: 1 },
          { tag: "phrases", label: "Phrases", lessons: 1 },
        ],
      },
    ])
    expect(report.subjects.map((s) => s.lessons).slice(2)).toEqual(
      Array(15).fill(0)
    )
    expect(report.singles).toEqual([
      { tag: "forms", label: "Forms", subject: "design" },
      { tag: "greetings", label: "Greetings", subject: "languages" },
      { tag: "phrases", label: "Phrases", subject: "languages" },
      { tag: "small-talk", label: "Small talk", subject: "languages" },
      { tag: "user-interface", label: "User interface", subject: "design" },
      {
        tag: "visual-hierarchy",
        label: "Visual hierarchy",
        subject: "design",
      },
    ])
    const text = formatTagReport(report, new Date(now))
    expect(text).toContain("Tag report, 2027-01-15: 3 listed lessons")
    expect(text).toMatch(/^ {2}design {2,}2 {2}Design$/m)
    expect(text).toMatch(/^ {2}history {2,}0 {2}History$/m)
    expect(text).toContain("    Buttons 2, Forms 1")
    expect(text).toContain("Tags used once (6)")
    expect(text).toContain("Forms (design)")
  })

  it("shows a key's most common label, and the key when the label doesn't spell it", async () => {
    await published("ada", {
      visibility: "public",
      text: withTags(buttons, ["JS", "Modals"]),
    })
    await published("ada", {
      visibility: "public",
      text: withTags(buttons, ["JavaScript", "modals"]),
    })
    await published("bob", {
      visibility: "public",
      text: withTags(buttons, ["JavaScript"]),
    })
    const report = await tagReport(db, { now })
    expect(report.subjects[0]?.tags).toEqual([
      { tag: "javascript", label: "JavaScript", lessons: 3 },
      // A tie between spellings goes by name, capitals first, so the report is stable.
      { tag: "modals", label: "Modals", lessons: 2 },
    ])
    const text = formatTagReport(report, new Date(now))
    expect(text).toContain("    JavaScript 3, Modals 2")
    // A label that doesn't spell its key (a synonym at work) shows the key too, since that's what
    // the synonym table maps.
    const lone = formatTagReport({
      lessons: 1,
      subjects: [
        {
          subject: "programming",
          lessons: 1,
          tags: [{ tag: "javascript", label: "JS", lessons: 1 }],
        },
      ],
      singles: [{ tag: "javascript", label: "JS", subject: "programming" }],
    })
    expect(lone).toContain("    JS [javascript] 1")
    expect(lone).toContain("  JS [javascript] (programming)")
  })

  it("keeps the tag table in step with the JSON on publish, update, and expiry", async () => {
    const reply = await publishLesson(
      { text: withTags(buttons, ["forms", "buttons"]), client: "x" },
      publish
    )
    const id = reply.body.id as string
    const tagsOf = async () =>
      (await db.select().from(lessonTag).where(eq(lessonTag.lessonId, id)))
        .map((r) => r.tag)
        .sort()
    expect(await tagsOf()).toEqual(["buttons", "forms"])
    const updated = await updateLesson(
      {
        id,
        editToken: reply.body.editToken as string,
        text: withTags(buttons, ["buttons", "modals"]),
        client: "x",
      },
      publish
    )
    expect(updated.status).toBe(200)
    expect(await tagsOf()).toEqual(["buttons", "modals"])
    now += 8 * DAY
    expect(await publish.store.deleteExpired()).toBe(1)
    expect(await tagsOf()).toEqual([])
  })
})

describe("tag backfill", () => {
  it("rewrites older rows to the current spec and rebuilds every lesson's tag rows", async () => {
    // A lesson stored before spec 0.6, as the database still holds some: a topic, no subject, no tag rows.
    const { subject: _subject, tags: _tags, ...rest } = JSON.parse(buttons)
    const old = { ...rest, spec: "0.5", topic: "Statistics" }
    await db.insert(lesson).values({
      id: "old12345",
      slug: "old",
      spec: "0.5",
      lesson: old,
      prepared: {},
      editTokenHash: "x",
      ownerId: "ada",
      visibility: "public",
    })
    // A current lesson whose tag rows went missing.
    const current = await published("ada", { visibility: "public" })
    await db.delete(lessonTag).where(eq(lessonTag.lessonId, current))
    const tagsOf = async (id: string) =>
      (await db.select().from(lessonTag).where(eq(lessonTag.lessonId, id)))
        .map((r) => r.tag)
        .sort()

    const dry = await backfillTags(db)
    expect(dry).toMatchObject({
      written: false,
      lessons: 2,
      upgraded: [
        {
          id: "old12345",
          from: "0.5",
          subject: "data",
          tags: ["Statistics"],
        },
      ],
      tagRows: 4,
      bySubject: { data: 1, design: 1 },
    })
    expect(await tagsOf("old12345")).toEqual([])
    expect(await tagsOf(current)).toEqual([])
    expect(formatBackfill(dry)).toContain("dry run")

    const done = await backfillTags(db, { write: true })
    expect(done.written).toBe(true)
    const [row] = await db
      .select()
      .from(lesson)
      .where(eq(lesson.id, "old12345"))
    expect(row?.spec).toBe("0.8")
    expect(row?.lesson).toMatchObject({
      spec: "0.8",
      subject: "data",
      tags: ["Statistics"],
    })
    expect(row?.lesson).not.toHaveProperty("topic")
    expect(await tagsOf("old12345")).toEqual(["statistics"])
    expect(
      await db
        .select({ label: lessonTag.label })
        .from(lessonTag)
        .where(eq(lessonTag.lessonId, "old12345"))
    ).toEqual([{ label: "Statistics" }])
    expect(await tagsOf(current)).toEqual([
      "buttons",
      "user-interface",
      "visual-hierarchy",
    ])
    // Running it again changes nothing.
    const again = await backfillTags(db, { write: true })
    expect(again.upgraded).toEqual([])
    expect(formatBackfill(again)).toContain("2 lessons, 0 rewritten")
  })
})
