import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { beforeEach, describe, expect, it } from "vitest"

import {
  checkLesson,
  compareVersions,
  LATEST_SKILL_VERSION,
  publishLesson,
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
import { FileLessonStore, LESSON_TTL_SECONDS } from "./store"

const example = (file: string) =>
  readFileSync(new URL(`../../../../examples/${file}`, import.meta.url), "utf8")
const buttons = example("button-hierarchy.json")

let deps: Deps
let now = 1_800_000_000_000
beforeEach(() => {
  now = 1_800_000_000_000
  deps = {
    store: new FileLessonStore(mkdtempSync(join(tmpdir(), "learn-test-"))),
    limiter: new MemoryRateLimiter(100),
    origin: "https://learn.test",
    now: () => now,
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
  it("publishes a valid lesson with a link, an edit token, and a 24-hour expiry", async () => {
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
      expiresAt: new Date(now + LESSON_TTL_SECONDS * 1000).toISOString(),
      skill: { latest: LATEST_SKILL_VERSION, updateAvailable: false },
    })
    const stored = await deps.store.get(reply.body.id as string)
    expect(stored?.lesson.title).toBe("Button hierarchy")
    expect(stored?.prepared.visualsCss).toContain(".flex-wrap")
    expect(stored?.editTokenHash).not.toBe(reply.body.editToken)
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

  it("expires lessons after 24 hours", async () => {
    const { body } = await publishLesson({ text: buttons, client: "x" }, deps)
    now += LESSON_TTL_SECONDS * 1000 + 1
    const realNow = Date.now
    Date.now = () => now
    try {
      expect(await deps.store.get(body.id as string)).toBeNull()
    } finally {
      Date.now = realNow
    }
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
