import { readFileSync } from "node:fs"

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { connectPglite, user, type Db } from "@workspace/db"

import { claimLesson } from "../publish/handlers"
import { hashToken } from "../publish/ids"
import { MemoryRateLimiter } from "../publish/rate-limit"
import { PostgresLessonStore } from "../publish/store"
import { skillBundle } from "../skill-files"
import { PostgresDraftStore } from "./drafts"
import { createLearnMcp, GUIDE_SECTIONS, type McpDeps } from "./server"

const example = (file: string) =>
  readFileSync(new URL(`../../../../examples/${file}`, import.meta.url), "utf8")
const buttons = example("button-hierarchy.json")

let db: Db
beforeAll(async () => {
  db = await connectPglite()
  await db
    .insert(user)
    .values({ id: "keeper", name: "keeper", email: "keeper@example.com" })
}, 30_000)

let deps: McpDeps
let mcp: (req: Request) => Promise<Response>
beforeEach(() => {
  deps = {
    store: new PostgresLessonStore(db),
    limiter: new MemoryRateLimiter(),
    validateLimiter: new MemoryRateLimiter(120),
    origin: "https://learn.test",
    guide: skillBundle,
    drafts: new PostgresDraftStore(db),
  }
  mcp = createLearnMcp(deps)
})

interface ToolResult {
  content: { type: string; text: string }[]
  structuredContent: Record<string, unknown>
  isError?: boolean
}

let nextId = 1
/** Sends one JSON-RPC request the way a client does, and reads the result out of the SSE reply. */
async function rpc(method: string, params: object, client = "1.2.3.4") {
  const res = await mcp(
    new Request("https://learn.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-forwarded-for": client,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    })
  )
  expect(res.status).toBe(200)
  const text = await res.text()
  const data = text
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)))
    .find((m) => "result" in m || "error" in m)
  if (data.error) throw new Error(JSON.stringify(data.error))
  return data.result
}

const call = (
  name: string,
  args: Record<string, unknown>,
  client?: string
): Promise<ToolResult> => rpc("tools/call", { name, arguments: args }, client)

describe("tools", () => {
  it("lists the five tools, each with a title and annotations", async () => {
    const { tools } = await rpc("tools/list", {})
    expect(tools.map((t: { name: string }) => t.name).sort()).toEqual([
      "get_guide",
      "keep_lesson",
      "publish_lesson",
      "update_lesson",
      "validate_lesson",
    ])
    for (const tool of tools) {
      expect(tool.title).toEqual(expect.any(String))
      expect(tool.annotations).toHaveProperty("readOnlyHint")
    }
  })
})

describe("get_guide", () => {
  const files = skillBundle().files

  it("returns every guide but the schema by default, in one call", async () => {
    const result = await call("get_guide", {})
    expect(result.isError).toBeFalsy()
    const paths = (result.structuredContent.files as { path: string }[]).map(
      (f) => f.path
    )
    expect(paths).toEqual([...GUIDE_SECTIONS.all])
    expect(paths).not.toContain("schema/lesson.schema.json")
    for (const path of paths)
      expect(result.content[0]!.text).toContain(files[path]!)
  })

  it("returns steps.md alone for steps", async () => {
    const result = await call("get_guide", { section: "steps" })
    expect(result.content[0]!.text).toBe(files["steps.md"])
    expect(result.content[0]!.text).toContain("get_guide")
  })

  it("returns every level file for levels", async () => {
    const result = await call("get_guide", { section: "levels" })
    const paths = (result.structuredContent.files as { path: string }[]).map(
      (f) => f.path
    )
    expect(paths).toEqual([...GUIDE_SECTIONS.levels])
    for (const path of paths) {
      expect(files[path]).toBeTruthy()
      expect(result.content[0]!.text).toContain(files[path]!)
    }
  })

  it("returns the schema as JSON", async () => {
    const result = await call("get_guide", { section: "schema" })
    expect(JSON.parse(result.content[0]!.text)).toHaveProperty("$schema")
  })

  it("has a file for every section", () => {
    for (const paths of Object.values(GUIDE_SECTIONS)) {
      for (const path of paths) expect(files[path]).toBeTruthy()
    }
  })
})

describe("validate_lesson", () => {
  it("passes a valid lesson and keeps it as a draft to publish", async () => {
    const result = await call("validate_lesson", { lesson: buttons })
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toEqual({
      ok: true,
      spec: JSON.parse(buttons).spec,
      draftId: expect.any(String),
    })
    const published = await call("publish_lesson", {
      draftId: result.structuredContent.draftId,
    })
    expect(published.isError).toBeFalsy()
    expect(published.structuredContent.url).toMatch(/button-hierarchy-/)
  })

  it("returns the checker's issues for a broken lesson", async () => {
    const broken = JSON.parse(buttons)
    delete broken.bricks[1].options[1].feedback
    const result = await call("validate_lesson", {
      lesson: JSON.stringify(broken),
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: "invalid_lesson",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: expect.anything() }),
      ]),
    })
    expect(result.structuredContent).not.toHaveProperty("skill")
    expect(JSON.parse(result.content[0]!.text)).toEqual(
      result.structuredContent
    )
  })
})

describe("publish_lesson and update_lesson", () => {
  it("publishes, then updates with the edit token", async () => {
    const published = await call("publish_lesson", { lesson: buttons })
    expect(published.isError).toBeFalsy()
    const body = published.structuredContent
    expect(body).toEqual({
      ok: true,
      id: expect.any(String),
      url: expect.stringMatching(
        /^https:\/\/learn\.test\/l\/button-hierarchy-/
      ),
      editToken: expect.any(String),
      claimUrl: expect.stringMatching(/^https:\/\/learn\.test\/keep\//),
      expiresAt: expect.any(String),
      owner: null,
      visibility: "unlisted",
    })
    expect((await deps.store.get(body.id as string))?.ownerId).toBeNull()

    const changed = { ...JSON.parse(buttons), title: "Buttons, ranked" }
    const updated = await call("update_lesson", {
      id: body.id,
      editToken: body.editToken,
      lesson: JSON.stringify(changed),
    })
    expect(updated.isError).toBeFalsy()
    expect(updated.structuredContent).toMatchObject({
      ok: true,
      id: body.id,
      url: `https://learn.test/l/buttons-ranked-${body.id}`,
    })
    expect((await deps.store.get(body.id as string))?.lesson.title).toBe(
      "Buttons, ranked"
    )
  })

  it("carries the keep sentence in publish_lesson's description, and the once-only rule", async () => {
    const { tools } = await rpc("tools/list", {})
    const publish = tools.find(
      (t: { name: string }) => t.name === "publish_lesson"
    )
    expect(publish.description).toContain("It lasts 7 days. To keep it, say so")
    expect(publish.description).toMatch(/once/)
    expect(publish.description).not.toContain("only when they ask")
  })

  it("refuses an update with the wrong token", async () => {
    const published = await call("publish_lesson", { lesson: buttons })
    const result = await call("update_lesson", {
      id: published.structuredContent.id,
      editToken: "not-the-token",
      lesson: buttons,
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ error: "unauthorized" })
  })

  it("rate-limits publishing per client", async () => {
    for (let i = 0; i < 20; i++) {
      const ok = await call("publish_lesson", { lesson: buttons }, "5.6.7.8")
      expect(ok.isError).toBeFalsy()
    }
    const limited = await call("publish_lesson", { lesson: buttons }, "5.6.7.8")
    expect(limited.isError).toBe(true)
    expect(limited.structuredContent).toMatchObject({ error: "rate_limited" })
    // Another client still gets through: the limit is per IP, not per server.
    const other = await call("publish_lesson", { lesson: buttons }, "9.9.9.9")
    expect(other.isError).toBeFalsy()
  }, 30_000)
})

describe("keep_lesson", () => {
  it("returns a fresh keep link for the edit token, and only for it", async () => {
    const published = await call("publish_lesson", { lesson: buttons })
    const { id, editToken, claimUrl } = published.structuredContent as {
      id: string
      editToken: string
      claimUrl: string
    }
    const wrong = await call("keep_lesson", { id, editToken: "not-the-token" })
    expect(wrong.isError).toBe(true)
    expect(wrong.structuredContent).toMatchObject({ error: "unauthorized" })

    const result = await call("keep_lesson", { id, editToken })
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toEqual({
      ok: true,
      id,
      url: published.structuredContent.url,
      claimUrl: expect.stringMatching(/^https:\/\/learn\.test\/keep\//),
      expiresAt: published.structuredContent.expiresAt,
    })
    // The token in the chat from publishing is dead; the new link keeps the lesson.
    const fresh = (result.structuredContent.claimUrl as string).split(
      "/keep/"
    )[1]!
    expect(result.structuredContent.claimUrl).not.toBe(claimUrl)
    expect(
      await deps.store.getByClaimTokenHash(
        hashToken(claimUrl.split("/keep/")[1]!)
      )
    ).toBeNull()
    const kept = await claimLesson(
      { claimToken: fresh, ownerId: "keeper" },
      deps
    )
    expect(kept.status).toBe(200)
    expect((await deps.store.get(id))?.ownerId).toBe("keeper")

    // Nothing left to keep.
    const again = await call("keep_lesson", { id, editToken })
    expect(again.structuredContent).toMatchObject({ error: "already_claimed" })
  })

  it("says when the lesson is gone", async () => {
    const gone = await call("keep_lesson", { id: "nope1234", editToken: "x" })
    expect(gone.structuredContent).toMatchObject({ error: "not_found" })
  })
})

describe("drafts and patches", () => {
  const original = JSON.parse(buttons)
  const feedback = original.bricks[1].options[1].feedback
  const broken = () => {
    const lesson = structuredClone(original)
    delete lesson.bricks[1].options[1].feedback
    return JSON.stringify(lesson)
  }

  it("publishes nothing for a broken lesson, then publishes the patched draft", async () => {
    const failed = await call("publish_lesson", { lesson: broken() })
    expect(failed.isError).toBe(true)
    const { draftId, issues, message } = failed.structuredContent as {
      draftId: string
      issues: { path: string }[]
      message: string
    }
    expect(draftId).toEqual(expect.any(String))
    expect(message).toContain("patches")
    const path = issues[0]!.path
    expect(path).toMatch(/^bricks\[1\]\.options\[1\]/)

    const fixed = await call("publish_lesson", {
      draftId,
      patches: [
        { op: "set", path: "bricks[1].options[1].feedback", value: feedback },
      ],
    })
    expect(fixed.isError).toBeFalsy()
    const lesson = await deps.store.get(fixed.structuredContent.id as string)
    expect(lesson?.lesson.title).toBe(original.title)
    // A published draft is gone.
    expect(await deps.drafts.get(draftId)).toBeNull()
  })

  it("keeps patching the same draft while it still fails", async () => {
    const failed = await call("validate_lesson", { lesson: broken() })
    const draftId = failed.structuredContent.draftId
    const still = await call("publish_lesson", {
      draftId,
      patches: [{ op: "set", path: "title", value: "Buttons" }],
    })
    expect(still.isError).toBe(true)
    expect(still.structuredContent.draftId).toBe(draftId)
    expect(JSON.parse((await deps.drafts.get(draftId as string))!).title).toBe(
      "Buttons"
    )
  })

  it("doesn't count failed checks as publishes", async () => {
    for (let i = 0; i < 25; i++) {
      const r = await call("publish_lesson", { lesson: broken() }, "7.7.7.7")
      expect(r.structuredContent.error).toBe("invalid_lesson")
    }
    const ok = await call("publish_lesson", { lesson: buttons }, "7.7.7.7")
    expect(ok.isError).toBeFalsy()
  }, 30_000)

  it("updates a published lesson from patches alone", async () => {
    const published = await call("publish_lesson", { lesson: buttons })
    const { id, editToken } = published.structuredContent
    const updated = await call("update_lesson", {
      id,
      editToken,
      patches: [{ op: "set", path: "title", value: "Buttons, ranked" }],
    })
    expect(updated.isError).toBeFalsy()
    expect(updated.structuredContent.url).toBe(
      `https://learn.test/l/buttons-ranked-${id}`
    )
    const stored = await deps.store.get(id as string)
    expect(stored?.lesson.title).toBe("Buttons, ranked")
    expect(stored?.lesson.bricks).toHaveLength(original.bricks.length)
  })

  it("refuses patches to a lesson with the wrong token", async () => {
    const published = await call("publish_lesson", { lesson: buttons })
    const result = await call("update_lesson", {
      id: published.structuredContent.id,
      editToken: "not-the-token",
      patches: [{ op: "set", path: "title", value: "Mine now" }],
    })
    expect(result.structuredContent).toMatchObject({ error: "unauthorized" })
    expect(
      (await deps.store.get(published.structuredContent.id as string))?.lesson
        .title
    ).toBe(original.title)
  })

  it("says when a draft is gone or a patch doesn't fit", async () => {
    const gone = await call("publish_lesson", {
      draftId: "nope",
      patches: [{ op: "set", path: "title", value: "x" }],
    })
    expect(gone.structuredContent).toMatchObject({ error: "draft_not_found" })

    const failed = await call("validate_lesson", { lesson: broken() })
    const bad = await call("publish_lesson", {
      draftId: failed.structuredContent.draftId,
      patches: [{ op: "set", path: "bricks[99].title", value: "x" }],
    })
    expect(bad.structuredContent).toMatchObject({ error: "bad_patch" })
    expect(bad.structuredContent.message).toContain("bricks[99].title")

    const neither = await call("publish_lesson", {})
    expect(neither.structuredContent).toMatchObject({ error: "bad_input" })
  })
})
