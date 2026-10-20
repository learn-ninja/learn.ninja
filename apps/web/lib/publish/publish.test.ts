import { readFileSync } from "node:fs"

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { connectPglite, lesson, user, type Db } from "@workspace/db"

import { handleOf } from "../auth/handles"
import {
  checkLesson,
  claimLesson,
  compareVersions,
  expireLessons,
  isCronRequest,
  LATEST_SKILL_VERSION,
  publishLesson,
  reissueClaimToken,
  updateLesson,
  type Deps,
} from "./handlers"
import {
  hashToken,
  idFromParam,
  lessonPath,
  newLessonId,
  slugify,
  tokenMatches,
} from "./ids"
import { MemoryRateLimiter } from "./rate-limit"
import { LESSON_TTL_SECONDS, PostgresLessonStore } from "./store"

const example = (file: string) =>
  readFileSync(new URL(`../../../../examples/${file}`, import.meta.url), "utf8")
const buttons = example("button-hierarchy.json")

// One in-memory Postgres for the file, with the real migrations. Lesson ids are random, so tests
// don't see each other's rows.
let db: Db
beforeAll(async () => {
  db = await connectPglite()
  // Owners must exist: lesson.owner_id references the user table. Only user_1 has picked a handle.
  await db.insert(user).values(
    ["user_1", "user_2", "user_3"].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      handle: id === "user_1" ? "one" : null,
    }))
  )
}, 30_000)

let deps: Deps
let now = 1_800_000_000_000
beforeEach(() => {
  now = 1_800_000_000_000
  deps = {
    store: new PostgresLessonStore(db, () => now),
    limiter: new MemoryRateLimiter(100),
    origin: "https://learn.test",
    now: () => now,
    handleOf: (id) => handleOf(db, id),
  }
})

describe("links and tokens", () => {
  it("builds readable links and reads the id back", () => {
    expect(slugify("How compound interest works!")).toBe(
      "how-compound-interest-works"
    )
    expect(slugify("¿Cómo estás?")).toBe("como-estas")
    expect(slugify("!!!")).toBe("lesson")
    const id = newLessonId()
    expect(id).toMatch(/^[0-9a-z]{8}$/)
    expect(lessonPath("writing-a-prd", id)).toBe(`/l/writing-a-prd-${id}`)
    expect(idFromParam(`writing-a-prd-${id}`)).toBe(id)
    expect(idFromParam("../../etc")).toBeNull()
  })

  it("stores only a hash of the edit token", () => {
    expect(tokenMatches("secret", hashToken("secret"))).toBe(true)
    expect(tokenMatches("guess", hashToken("secret"))).toBe(false)
  })

  it("compares skill versions", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBeLessThan(0)
    expect(compareVersions("1.0.0", "0.9.9")).toBeGreaterThan(0)
    expect(compareVersions(LATEST_SKILL_VERSION, LATEST_SKILL_VERSION)).toBe(0)
  })
})

describe("publishing", () => {
  it("publishes a valid lesson with a link, an edit token, and a 7-day expiry", async () => {
    const reply = await publishLesson(
      { text: buttons, client: "1.2.3.4", skillVersion: LATEST_SKILL_VERSION },
      deps
    )
    expect(reply.status).toBe(201)
    expect(reply.body).toMatchObject({
      ok: true,
      url: expect.stringMatching(
        /^https:\/\/learn\.test\/l\/button-hierarchy-[0-9a-z]{8}$/
      ),
      editToken: expect.any(String),
      claimToken: expect.any(String),
      claimUrl: expect.stringMatching(/^https:\/\/learn\.test\/keep\/[\w-]+$/),
      owned: false,
      expiresAt: new Date(now + LESSON_TTL_SECONDS * 1000).toISOString(),
      owner: null,
      visibility: "unlisted",
      skill: { latest: LATEST_SKILL_VERSION, updateAvailable: false },
    })
    expect(reply.body.claimUrl).toBe(
      `https://learn.test/keep/${reply.body.claimToken}`
    )
    const stored = await deps.store.get(reply.body.id as string)
    expect(stored?.lesson.title).toBe("Button hierarchy")
    expect(stored?.prepared.visualsCss).toContain(".flex-wrap")
    expect(stored?.editTokenHash).not.toBe(reply.body.editToken)
    expect(stored?.claimTokenHash).toBe(
      hashToken(reply.body.claimToken as string)
    )
    expect(stored?.visibility).toBe("unlisted")
    expect(stored?.ownerId).toBeNull()
  })

  it("publishes an owned lesson listed, with no expiry and no claim token, naming the owner", async () => {
    const reply = await publishLesson(
      { text: buttons, client: "x", ownerId: "user_1" },
      deps
    )
    expect(reply.body).toMatchObject({
      owned: true,
      expiresAt: null,
      owner: { handle: "one" },
      visibility: "public",
    })
    // An owner without a handle yet is still named, so clients can say where to pick one.
    const unnamed = await publishLesson(
      { text: buttons, client: "x", ownerId: "user_2" },
      deps
    )
    expect(unnamed.body.owner).toEqual({ handle: null })
    // A route that already has the actor passes the handle, and no lookup runs.
    deps.handleOf = async () => {
      throw new Error("looked up")
    }
    const known = await publishLesson(
      { text: buttons, client: "x", ownerId: "user_2", ownerHandle: "two" },
      deps
    )
    expect(known.body.owner).toEqual({ handle: "two" })
    expect(reply.body).not.toHaveProperty("claimToken")
    expect(reply.body).not.toHaveProperty("claimUrl")
    const stored = await deps.store.get(reply.body.id as string)
    expect(stored).toMatchObject({
      ownerId: "user_1",
      expiresAt: null,
      claimTokenHash: null,
      visibility: "public",
    })
    // Never swept, and still there long after anonymous lessons are gone.
    now += 365 * 24 * 3.6e6
    await expireLessons(deps)
    expect(await deps.store.get(reply.body.id as string)).not.toBeNull()
  })

  it("stores highlighted code for a lesson with code visuals", async () => {
    // Postgres jsonb rejects NUL in strings, so prepared.code keys must not contain one.
    const reply = await publishLesson(
      { text: example("map-vs-foreach.json"), client: "x" },
      deps
    )
    expect(reply.status).toBe(201)
    const stored = await deps.store.get(reply.body.id as string)
    const keys = Object.keys(stored?.prepared.code ?? {})
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(key).not.toContain("\u0000")
      expect(key.split("\n")[0]).toBe("javascript")
      expect(stored?.prepared.code[key]?.length).toBeGreaterThan(0)
    }
  })

  it("rejects an invalid lesson with the spec's issues", async () => {
    const lesson = JSON.parse(buttons)
    delete lesson.bricks[1].options[1].feedback
    const reply = await publishLesson(
      { text: JSON.stringify(lesson), client: "x" },
      deps
    )
    expect(reply.status).toBe(422)
    expect(reply.body).toMatchObject({
      ok: false,
      error: "invalid_lesson",
      issues: [expect.objectContaining({ path: "bricks[1].options[1]" })],
    })
  })

  it("rejects an unsupported spec version and says how to update", async () => {
    const reply = await publishLesson(
      {
        text: JSON.stringify({ ...JSON.parse(buttons), spec: "0.1" }),
        client: "x",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 422,
      body: { error: "unsupported_spec", skill: { updateAvailable: true } },
    })
  })

  it("upgrades a spec 0.2 lesson from an older skill", async () => {
    const { bricks, ...rest } = JSON.parse(buttons)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loops: { concept: any; practice: any[] }[] = []
    for (const { type, ...brick } of bricks)
      if (type === "concept") loops.push({ concept: brick, practice: [] })
      else loops.at(-1)!.practice.push({ type, ...brick })
    const reply = await publishLesson(
      {
        text: JSON.stringify({ ...rest, spec: "0.2", loops }),
        client: "x",
        skillVersion: "0.2.0",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 201,
      body: { spec: "0.5", skill: { updateAvailable: true } },
    })
    const stored = await deps.store.get(reply.body.id as string)
    expect(stored?.lesson).toEqual(JSON.parse(buttons))
  })

  it("tells an older skill to update", async () => {
    const reply = await publishLesson(
      { text: buttons, client: "x", skillVersion: "0.0.1" },
      deps
    )
    expect(reply.body.skill).toMatchObject({
      updateAvailable: true,
      updateCommand: expect.stringContaining("npx skills add"),
    })
  })

  it("rejects files over 500 KB", async () => {
    const reply = await publishLesson(
      { text: " ".repeat(501 * 1024), client: "x" },
      deps
    )
    expect(reply).toMatchObject({ status: 413, body: { error: "too_large" } })
  })

  it("rate-limits by client", async () => {
    deps.limiter = new MemoryRateLimiter(1)
    expect(
      (await publishLesson({ text: buttons, client: "a" }, deps)).status
    ).toBe(201)
    expect(
      (await publishLesson({ text: buttons, client: "a" }, deps)).status
    ).toBe(429)
    expect(
      (await publishLesson({ text: buttons, client: "b" }, deps)).status
    ).toBe(201)
  })

  it("expires lessons after 7 days", async () => {
    expect(LESSON_TTL_SECONDS).toBe(7 * 24 * 60 * 60)
    const { body } = await publishLesson({ text: buttons, client: "x" }, deps)
    now += LESSON_TTL_SECONDS * 1000 - 1
    expect(await deps.store.get(body.id as string)).not.toBeNull()
    now += 1
    expect(await deps.store.get(body.id as string)).toBeNull()
  })
})

describe("claiming", () => {
  const anonymous = () => publishLesson({ text: buttons, client: "x" }, deps)

  it("keeps a lesson with its id and claim token: owned, listed, never expiring, token spent", async () => {
    const { body } = await anonymous()
    const reply = await claimLesson(
      {
        id: body.id as string,
        claimToken: body.claimToken as string,
        ownerId: "user_1",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 200,
      body: {
        ok: true,
        id: body.id,
        url: body.url,
        title: "Button hierarchy",
        owned: true,
        expiresAt: null,
        owner: { handle: "one" },
        visibility: "public",
      },
    })
    const stored = await deps.store.get(body.id as string)
    expect(stored).toMatchObject({
      ownerId: "user_1",
      expiresAt: null,
      claimTokenHash: null,
      visibility: "public",
    })
    // The reply describes the row as claiming left it, not as it was read before.
    expect(reply.body.visibility).toBe(stored?.visibility)
    // The token is spent: nobody else can use it, and the /keep page no longer finds the lesson.
    expect(
      await deps.store.getByClaimTokenHash(hashToken(body.claimToken as string))
    ).toBeNull()
    const again = await claimLesson(
      {
        id: body.id as string,
        claimToken: body.claimToken as string,
        ownerId: "user_2",
      },
      deps
    )
    expect(again).toMatchObject({
      status: 409,
      body: { error: "already_claimed" },
    })
    // The owner asking again is fine.
    const mine = await claimLesson(
      { id: body.id as string, claimToken: "whatever", ownerId: "user_1" },
      deps
    )
    expect(mine.status).toBe(200)
  })

  it("keeps a lesson from the token alone (the /keep link)", async () => {
    const { body } = await anonymous()
    const reply = await claimLesson(
      { claimToken: body.claimToken as string, ownerId: "user_3" },
      deps
    )
    expect(reply).toMatchObject({ status: 200, body: { id: body.id } })
    expect((await deps.store.get(body.id as string))?.ownerId).toBe("user_3")
  })

  it("refuses a wrong token, an unknown lesson, and a dead link", async () => {
    const { body } = await anonymous()
    expect(
      await claimLesson(
        { id: body.id as string, claimToken: "wrong", ownerId: "user_1" },
        deps
      )
    ).toMatchObject({ status: 401, body: { error: "unauthorized" } })
    expect(
      await claimLesson({ claimToken: "wrong", ownerId: "user_1" }, deps)
    ).toMatchObject({ status: 404, body: { error: "not_found" } })
    expect(
      await claimLesson(
        { id: "nope1234", claimToken: body.claimToken as string, ownerId: "u" },
        deps
      )
    ).toMatchObject({ status: 404 })
    // Expired lessons can't be claimed: there's nothing left to keep.
    now += LESSON_TTL_SECONDS * 1000 + 1
    expect(
      await claimLesson(
        { claimToken: body.claimToken as string, ownerId: "user_1" },
        deps
      )
    ).toMatchObject({ status: 404 })
  })

  it("keeps a lesson with its edit token instead of the claim token", async () => {
    const { body } = await anonymous()
    const wrong = await claimLesson(
      { id: body.id as string, editToken: "wrong", ownerId: "user_1" },
      deps
    )
    expect(wrong).toMatchObject({
      status: 401,
      body: {
        error: "unauthorized",
        message: expect.stringContaining("edit token"),
      },
    })
    // The edit token alone needs the id: there's no lookup by it.
    expect(
      await claimLesson(
        { editToken: body.editToken as string, ownerId: "user_1" },
        deps
      )
    ).toMatchObject({ status: 404 })
    const reply = await claimLesson(
      {
        id: body.id as string,
        editToken: body.editToken as string,
        ownerId: "user_2",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 200,
      body: { owned: true, expiresAt: null, owner: { handle: null } },
    })
    expect((await deps.store.get(body.id as string))?.ownerId).toBe("user_2")
    // Another account with the same edit token is still refused: ownership is settled.
    expect(
      await claimLesson(
        {
          id: body.id as string,
          editToken: body.editToken as string,
          ownerId: "user_1",
        },
        deps
      )
    ).toMatchObject({ status: 409, body: { error: "already_claimed" } })
    // Both tokens together: either one matching is enough.
    const other = await anonymous()
    expect(
      (
        await claimLesson(
          {
            id: other.body.id as string,
            claimToken: "stale",
            editToken: other.body.editToken as string,
            ownerId: "user_1",
          },
          deps
        )
      ).status
    ).toBe(200)
  })

  it("re-issues a claim token to the edit token's holder, and the old one stops working", async () => {
    const { body } = await anonymous()
    const client = "1.2.3.4"
    expect(
      await reissueClaimToken(
        { id: body.id as string, editToken: "wrong", client },
        deps
      )
    ).toMatchObject({ status: 401, body: { error: "unauthorized" } })
    expect(
      await reissueClaimToken(
        { id: "nope1234", editToken: body.editToken as string, client },
        deps
      )
    ).toMatchObject({ status: 404, body: { error: "not_found" } })

    const reply = await reissueClaimToken(
      { id: body.id as string, editToken: body.editToken as string, client },
      deps
    )
    expect(reply).toMatchObject({
      status: 200,
      body: {
        ok: true,
        id: body.id,
        url: body.url,
        title: "Button hierarchy",
        claimToken: expect.any(String),
        claimUrl: expect.stringMatching(/^https:\/\/learn\.test\/keep\//),
        expiresAt: body.expiresAt,
      },
    })
    const fresh = reply.body.claimToken as string
    expect(fresh).not.toBe(body.claimToken)
    expect(reply.body.claimUrl).toBe(`https://learn.test/keep/${fresh}`)
    // The publish-time token is gone; the /keep page finds the lesson by the new one.
    expect(
      await deps.store.getByClaimTokenHash(hashToken(body.claimToken as string))
    ).toBeNull()
    expect((await deps.store.getByClaimTokenHash(hashToken(fresh)))?.id).toBe(
      body.id
    )
    expect(
      await claimLesson(
        {
          id: body.id as string,
          claimToken: body.claimToken as string,
          ownerId: "user_1",
        },
        deps
      )
    ).toMatchObject({ status: 401 })
    expect(
      (await claimLesson({ claimToken: fresh, ownerId: "user_1" }, deps)).status
    ).toBe(200)
    // Once kept, there's nothing to re-issue, even for the edit token's holder.
    expect(
      await reissueClaimToken(
        { id: body.id as string, editToken: body.editToken as string, client },
        deps
      )
    ).toMatchObject({ status: 409, body: { error: "already_claimed" } })
  })

  it("answers already_claimed when the lesson is claimed between the read and the write", async () => {
    const { body } = await anonymous()
    const slow = { ...deps.store } as typeof deps.store
    // The store's view is still anonymous when the handler reads, but claimed by the time it writes.
    slow.get = async (id) =>
      (await deps.store.get(id)) && {
        ...(await deps.store.get(id))!,
        ownerId: null,
      }
    slow.setClaimToken = deps.store.setClaimToken.bind(deps.store)
    await claimLesson(
      {
        id: body.id as string,
        claimToken: body.claimToken as string,
        ownerId: "user_1",
      },
      deps
    )
    const reply = await reissueClaimToken(
      {
        id: body.id as string,
        editToken: body.editToken as string,
        client: "y",
      },
      { ...deps, store: slow }
    )
    expect(reply).toMatchObject({
      status: 409,
      body: { error: "already_claimed" },
    })
    expect((await deps.store.get(body.id as string))?.claimTokenHash).toBeNull()
  })

  it("rate-limits re-issuing by client", async () => {
    const { body } = await anonymous()
    deps.limiter = new MemoryRateLimiter(1)
    const req = {
      id: body.id as string,
      editToken: body.editToken as string,
      client: "z",
    }
    expect((await reissueClaimToken(req, deps)).status).toBe(200)
    expect((await reissueClaimToken(req, deps)).status).toBe(429)
  })

  it("keeps the edit token working after a claim", async () => {
    const { body } = await anonymous()
    await claimLesson(
      { claimToken: body.claimToken as string, ownerId: "user_1" },
      deps
    )
    const reply = await updateLesson(
      {
        id: body.id as string,
        editToken: body.editToken as string,
        text: buttons,
        client: "x",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 200,
      body: { owned: true, expiresAt: null, owner: { handle: "one" } },
    })
  })
})

describe("the expiry sweep", () => {
  it("sweeps expired lessons and keeps live ones", async () => {
    const old = await publishLesson({ text: buttons, client: "x" }, deps)
    now += LESSON_TTL_SECONDS * 1000 - 60_000
    const fresh = await publishLesson({ text: buttons, client: "x" }, deps)
    now += 60_000
    const reply = await expireLessons(deps)
    expect(reply.status).toBe(200)
    expect(reply.body.deleted).toBeGreaterThanOrEqual(1)
    const ids = (await db.select({ id: lesson.id }).from(lesson)).map(
      (row) => row.id
    )
    expect(ids).not.toContain(old.body.id)
    expect(ids).toContain(fresh.body.id)
    expect(await deps.store.get(fresh.body.id as string)).not.toBeNull()
  })

  it("only runs with the cron secret", () => {
    expect(isCronRequest("Bearer s3cret", "s3cret")).toBe(true)
    expect(isCronRequest("Bearer guess", "s3cret")).toBe(false)
    expect(isCronRequest("s3cret", "s3cret")).toBe(false)
    expect(isCronRequest(null, "s3cret")).toBe(false)
    // No secret configured: nobody can run it.
    expect(isCronRequest("Bearer ", "")).toBe(false)
  })
})

describe("checking", () => {
  it("accepts a valid lesson without storing it", async () => {
    const reply = await checkLesson({ text: buttons, client: "x" }, deps)
    expect(reply).toMatchObject({
      status: 200,
      body: { ok: true, spec: "0.5", skill: { updateAvailable: false } },
    })
    expect(reply.body).not.toHaveProperty("id")
    expect(reply.body).not.toHaveProperty("editToken")
  })

  it("lists the same issues publishing would", async () => {
    const broken = JSON.parse(buttons)
    delete broken.bricks[1].options[1].feedback
    const text = JSON.stringify(broken)
    const checked = await checkLesson({ text, client: "x" }, deps)
    const published = await publishLesson({ text, client: "x" }, deps)
    expect(checked.status).toBe(422)
    expect(checked.body.issues).toEqual(published.body.issues)
  })

  it("rejects a diagram whose D2 doesn't compile, and draws one that does", async () => {
    const lesson = JSON.parse(buttons)
    const diagram = {
      kind: "diagram",
      d2: "idea -> draft -> review",
      alt: "An idea becomes a draft, then gets reviewed.",
    }
    lesson.bricks[0].visual = { ...diagram, d2: "idea -> {" }
    const checked = await checkLesson(
      { text: JSON.stringify(lesson), client: "x" },
      deps
    )
    expect(checked.status).toBe(422)
    expect(checked.body.issues).toEqual([
      expect.objectContaining({
        path: "bricks[0].visual.d2",
        message: expect.stringMatching(/doesn't compile: line 1:/),
      }),
    ])

    lesson.bricks[0].visual = diagram
    const reply = await publishLesson(
      { text: JSON.stringify(lesson), client: "x" },
      deps
    )
    expect(reply.status).toBe(201)
    const stored = await deps.store.get(reply.body.id as string)
    expect(Object.values(stored!.prepared.diagrams!)[0]).toContain(">draft<")
  }, 20_000)

  it("tells an old skill to update", async () => {
    const reply = await checkLesson(
      { text: buttons, client: "x", skillVersion: "0.1.0" },
      deps
    )
    expect(reply.body.skill).toMatchObject({ updateAvailable: true })
  })

  it("has its own rate limit", async () => {
    deps.limiter = new MemoryRateLimiter(1)
    expect(
      (await checkLesson({ text: buttons, client: "a" }, deps)).status
    ).toBe(200)
    expect(
      (await checkLesson({ text: buttons, client: "a" }, deps)).status
    ).toBe(429)
  })
})

describe("updating", () => {
  it("updates with the edit token, keeping the link and expiry", async () => {
    const created = await publishLesson({ text: buttons, client: "x" }, deps)
    now += 60_000
    const changed = JSON.stringify({
      ...JSON.parse(buttons),
      summary: "A new summary.",
    })
    const reply = await updateLesson(
      {
        id: created.body.id as string,
        editToken: created.body.editToken as string,
        text: changed,
        client: "x",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 200,
      body: {
        ok: true,
        url: created.body.url,
        expiresAt: created.body.expiresAt,
      },
    })
    expect(
      (await deps.store.get(created.body.id as string))?.lesson.summary
    ).toBe("A new summary.")
  })

  it("refuses an update without the right token", async () => {
    const created = await publishLesson({ text: buttons, client: "x" }, deps)
    const reply = await updateLesson(
      {
        id: created.body.id as string,
        editToken: "wrong",
        text: buttons,
        client: "x",
      },
      deps
    )
    expect(reply).toMatchObject({
      status: 401,
      body: { error: "unauthorized" },
    })
  })

  it("reports a missing or expired lesson", async () => {
    const reply = await updateLesson(
      { id: "nope1234", editToken: "x", text: buttons, client: "x" },
      deps
    )
    expect(reply).toMatchObject({ status: 404, body: { error: "not_found" } })
  })
})

describe("respond", () => {
  it("reports missing storage and unexpected errors as JSON", async () => {
    const { respond } = await import("./respond")
    const { StorageNotConfiguredError } = await import("./store")
    const missing = await respond(async () => {
      throw new StorageNotConfiguredError()
    })
    expect(missing.status).toBe(503)
    expect((await missing.json()).error).toBe("storage_not_configured")
    const { InvalidApiKeyError } = await import("../auth/actor")
    const badKey = await respond(async () => {
      throw new InvalidApiKeyError()
    })
    expect(badKey.status).toBe(401)
    expect((await badKey.json()).error).toBe("invalid_api_key")
    const original = console.error
    console.error = () => {}
    const broken = await respond(async () => {
      throw new Error("boom")
    })
    console.error = original
    expect(broken.status).toBe(500)
    expect((await broken.json()).error).toBe("server_error")
  })
})
