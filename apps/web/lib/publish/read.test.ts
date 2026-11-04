import { readFileSync } from "node:fs"

import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { connectPglite, lesson, type Db } from "@workspace/db"
import { emptyPrepared } from "@workspace/player-core/prepared"
import type { Lesson } from "@workspace/spec"

import { publishLesson, type Deps } from "./handlers"
import { MemoryRateLimiter } from "./rate-limit"
import { readLesson, type ReadDeps } from "./read"
import { PostgresLessonStore } from "./store"

const buttons = readFileSync(
  new URL("../../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

let db: Db
beforeAll(async () => {
  db = await connectPglite()
}, 30_000)

let now = 1_800_000_000_000
let publish: Deps
let read: ReadDeps
beforeEach(() => {
  now = 1_800_000_000_000
  const store = new PostgresLessonStore(db, () => now)
  publish = {
    store,
    limiter: new MemoryRateLimiter(100),
    origin: "https://learn.test",
    now: () => now,
  }
  read = {
    store,
    limiter: new MemoryRateLimiter(100),
    visualsCssUrl: "/lesson-visuals.css?v=abc123",
    bundled: async (slug) =>
      slug === "button-hierarchy"
        ? {
            lesson: JSON.parse(buttons) as Lesson,
            prepared: emptyPrepared,
          }
        : null,
  }
})

async function published() {
  const { body } = await publishLesson({ text: buttons, client: "x" }, publish)
  return body.id as string
}

describe("reading a lesson", () => {
  it("returns a published lesson and what was prepared for it, by id or link segment", async () => {
    const id = await published()
    for (const param of [id, `button-hierarchy-${id}`]) {
      const reply = await readLesson({ param, client: "x" }, read)
      expect(reply.status).toBe(200)
      expect(reply.body).toMatchObject({
        ok: true,
        id,
        path: `/l/button-hierarchy-${id}`,
        lesson: { title: expect.any(String) },
        prepared: { visualsCss: expect.any(String) },
        visualsCssUrl: "/lesson-visuals.css?v=abc123",
        expiresAt: now + 7 * 24 * 3600 * 1000,
      })
    }
  })

  it("returns a bundled test lesson by its slug, without a database row", async () => {
    const reply = await readLesson(
      { param: "button-hierarchy", client: "x" },
      read
    )
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({
      ok: true,
      id: "button-hierarchy",
      path: "/lessons/button-hierarchy",
      expiresAt: null,
    })
  })

  it("is a 404 when the lesson is missing, expired, or hidden", async () => {
    const missing = await readLesson({ param: "zzzzzzzz", client: "x" }, read)
    expect(missing).toMatchObject({ status: 404, body: { error: "not_found" } })
    expect(
      (await readLesson({ param: "not a lesson", client: "x" }, read)).status
    ).toBe(404)

    const hidden = await published()
    await db.update(lesson).set({ hidden: true }).where(eq(lesson.id, hidden))
    expect(
      (await readLesson({ param: hidden, client: "x" }, read)).status
    ).toBe(404)

    const expiring = await published()
    now += 8 * 24 * 3600 * 1000
    expect(
      (await readLesson({ param: expiring, client: "x" }, read)).status
    ).toBe(404)
  })

  it("adds the prepared formulas drawn as SVG, by the same keys", async () => {
    const math = { "i:x^2": "<span>…</span>" }
    read.bundled = async () => ({
      lesson: JSON.parse(buttons) as Lesson,
      prepared: { ...emptyPrepared, math },
    })
    read.drawMath = (prepared) =>
      Object.fromEntries(
        Object.keys(prepared.math).map((key) => [
          key,
          { svg: "<svg></svg>", width: 1, ascent: 1, descent: 0 },
        ])
      )
    const bundled = await readLesson({ param: "x", client: "x" }, read)
    expect(bundled.body).toMatchObject({ mathSvg: { "i:x^2": {} } })
    const id = await published()
    const stored = await readLesson({ param: id, client: "x" }, read)
    expect(stored.body).toHaveProperty("mathSvg")
  })

  it("limits reads per client", async () => {
    read.limiter = new MemoryRateLimiter(1)
    const first = await readLesson(
      { param: "button-hierarchy", client: "a" },
      read
    )
    const second = await readLesson(
      { param: "button-hierarchy", client: "a" },
      read
    )
    expect(first.status).toBe(200)
    expect(second).toMatchObject({
      status: 429,
      body: { error: "rate_limited" },
    })
  })
})
