import { readFileSync } from "node:fs"

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { eq } from "drizzle-orm"

import { connectPglite, lesson, session, user, type Db } from "@workspace/db"

import { connectMcp, createKey } from "../auth/account"
import { getActor } from "../auth/actor"
import { createAuth, type Auth } from "../auth/auth"
import { handleOf } from "../auth/handles"
import { MemoryRateLimiter } from "../publish/rate-limit"
import { PostgresLessonStore } from "../publish/store"
import { skillBundle } from "../skill-files"
import { PostgresDraftStore } from "./drafts"
import { handlePersonalMcp } from "./personal"
import {
  createLearnMcp,
  GUIDE_SECTIONS,
  KEEP_SENTENCE,
  type McpDeps,
} from "./server"

const example = (file: string) =>
  readFileSync(new URL(`../../../../examples/${file}`, import.meta.url), "utf8")
const buttons = example("button-hierarchy.json")

let db: Db
let auth: Auth
/** The last code "sent" to each address. */
const codes = new Map<string, string>()
beforeAll(async () => {
  db = await connectPglite()
  await db
    .insert(user)
    .values({ id: "keeper", name: "keeper", email: "keeper@example.com" })
  auth = createAuth({
    db,
    env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    sendCode: async (email, code) => {
      codes.set(email, code)
    },
    codeLimiter: new MemoryRateLimiter(100),
  })
}, 30_000)

let deps: McpDeps
let mcp: (req: Request) => Promise<Response>
let listed = 0
beforeEach(() => {
  listed = 0
  deps = {
    store: new PostgresLessonStore(db),
    limiter: new MemoryRateLimiter(),
    validateLimiter: new MemoryRateLimiter(120),
    origin: "https://learn.test",
    guide: skillBundle,
    drafts: new PostgresDraftStore(db),
    handleOf: (id) => handleOf(db, id),
    exploreChanged: () => {
      listed++
    },
  }
  mcp = createLearnMcp(deps)
})

interface ToolResult {
  content: { type: string; text: string }[]
  structuredContent: Record<string, unknown>
  isError?: boolean
}

let nextId = 1
const rpcRequest = (
  url: string,
  method: string,
  params: object,
  client: string
) =>
  new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-forwarded-for": client,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  })

/** Reads the result out of an SSE reply. */
async function resultOf(res: Response) {
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

/** Sends one JSON-RPC request to /mcp the way a client does. */
async function rpc(method: string, params: object, client = "1.2.3.4") {
  return resultOf(
    await mcp(rpcRequest("https://learn.test/mcp", method, params, client))
  )
}

const call = (
  name: string,
  args: Record<string, unknown>,
  client?: string
): Promise<ToolResult> => rpc("tools/call", { name, arguments: args }, client)

/** The same, to the personal URL /mcp/{key}. */
const personal = (key: string) => ({
  raw: (method: string, params: object) =>
    handlePersonalMcp(
      rpcRequest(`https://learn.test/mcp/${key}`, method, params, "1.2.3.4"),
      key,
      auth,
      db,
      deps
    ),
  rpc: async (method: string, params: object) =>
    resultOf(await personal(key).raw(method, params)),
  call: (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
    personal(key).rpc("tools/call", { name, arguments: args }),
})

/** Signs `email` in with a code, as the website does, and returns the session cookie. */
async function signIn(email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: codes.get(email)! },
    asResponse: true,
  })
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
}

/** A personal MCP URL's key for `email`, made from the settings page. */
async function mcpKeyFor(email: string): Promise<string> {
  const cookie = await signIn(email)
  const made = await connectMcp(auth, new Headers({ cookie }), (await getActor(auth, new Headers({ cookie })))!.userId, deps.origin)
  expect(made.status).toBe(201)
  return (made.body.url as string).split("/mcp/")[1]!
}

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

  it("says which tools work signed out, the way ChatGPT reads it", async () => {
    const { tools } = await rpc("tools/list", {})
    const schemes = Object.fromEntries(
      tools.map((t: { name: string; _meta?: { securitySchemes?: unknown } }) => [
        t.name,
        t._meta?.securitySchemes,
      ])
    )
    const optional = [{ type: "noauth" }, { type: "oauth2", scopes: ["lessons"] }]
    expect(schemes).toEqual({
      get_guide: optional,
      validate_lesson: optional,
      publish_lesson: optional,
      update_lesson: optional,
      keep_lesson: [{ type: "oauth2", scopes: ["lessons"] }],
    })
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

  it("describes publishing without telling the model what to say: the guide does that", async () => {
    const { tools } = await rpc("tools/list", {})
    const publish = tools.find(
      (t: { name: string }) => t.name === "publish_lesson"
    )
    // Directory review rejects descriptions that script Claude's behaviour; the keep sentence and
    // the once-only rule live in the guide's steps, which both surfaces follow.
    expect(publish.description).not.toMatch(/tell the user|say once|never paste/i)
    expect(publish.description).toContain("7 days")
    expect(KEEP_SENTENCE).toContain("sign in once")
    expect(skillBundle().files["steps.md"]).toContain(KEEP_SENTENCE)
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
  it("takes no email or code, and needs the user signed in", async () => {
    const { tools } = await rpc("tools/list", {})
    const keep = tools.find((t: { name: string }) => t.name === "keep_lesson")
    expect(Object.keys(keep.inputSchema.properties).sort()).toEqual([
      "editToken",
      "id",
    ])
    expect(keep.description).toMatch(/signed in/)
    expect(keep.description).not.toMatch(/email|code/)

    // Signed out, the gate in front of the route answers 401 (oauth.test.ts); the tool itself,
    // reached by a client that ignored it, says the same in words and keeps nothing.
    const published = await call("publish_lesson", { lesson: buttons })
    const { id, editToken } = published.structuredContent as {
      id: string
      editToken: string
    }
    const refused = await call("keep_lesson", { id, editToken })
    expect(refused.isError).toBe(true)
    expect(refused.structuredContent).toMatchObject({
      error: "sign_in_required",
    })
    expect((await deps.store.get(id))?.ownerId).toBeNull()
    expect(listed).toBe(0)
  })

  it("keeps a lesson for the signed-in account, once", async () => {
    const key = await mcpKeyFor("keeper-two@example.com")
    const published = await call("publish_lesson", { lesson: buttons })
    const { id, editToken } = published.structuredContent as {
      id: string
      editToken: string
    }
    const wrong = await personal(key).call("keep_lesson", {
      id,
      editToken: "not-the-token",
    })
    expect(wrong.isError).toBe(true)
    expect(wrong.structuredContent).toMatchObject({ error: "unauthorized" })

    const kept = await personal(key).call("keep_lesson", { id, editToken })
    expect(kept.isError).toBeFalsy()
    expect(kept.structuredContent).toEqual({
      ok: true,
      id,
      url: published.structuredContent.url,
      title: JSON.parse(buttons).title,
      expiresAt: null,
      owner: { handle: null },
      visibility: "public",
    })
    expect(listed).toBe(1)
    const [account] = await db
      .select()
      .from(user)
      .where(eq(user.email, "keeper-two@example.com"))
    expect((await deps.store.get(id))?.ownerId).toBe(account!.id)
    // Nothing is in the reply that could sign in as the user.
    expect(JSON.stringify(kept)).not.toMatch(/session|token/i)

    // Keeping it again changes nothing: same owner.
    const again = await personal(key).call("keep_lesson", { id, editToken })
    expect(again.structuredContent).toMatchObject({ ok: true, id })
    // Another account can't take it.
    const other = await mcpKeyFor("keeper-rival@example.com")
    const taken = await personal(other).call("keep_lesson", { id, editToken })
    expect(taken.structuredContent).toMatchObject({ error: "already_claimed" })
  })

  it("says when the lesson is gone", async () => {
    const key = await mcpKeyFor("keeper-three@example.com")
    const gone = await personal(key).call("keep_lesson", {
      id: "nope1234",
      editToken: "x",
    })
    expect(gone.structuredContent).toMatchObject({ error: "not_found" })
  })
})

describe("/mcp/{key}, the personal URL", () => {
  it("publishes to the account, unlisted, and the owner updates without a token", async () => {
    const key = await mcpKeyFor("owner@example.com")
    const { tools } = await personal(key).rpc("tools/list", {})
    const publish = tools.find((t: { name: string }) => t.name === "publish_lesson")
    expect(publish.description).toContain("saved to the user's account")
    expect(publish.description).not.toContain("7 days")

    const published = await personal(key).call("publish_lesson", {
      lesson: buttons,
    })
    expect(published.isError).toBeFalsy()
    const body = published.structuredContent
    expect(body).toMatchObject({
      ok: true,
      expiresAt: null,
      owner: { handle: null },
      visibility: "unlisted",
    })
    expect(body).not.toHaveProperty("claimUrl")
    // Nor the edit token: the account edits, and a shared chat shouldn't carry a secret.
    expect(body).not.toHaveProperty("editToken")
    const [account] = await db
      .select()
      .from(user)
      .where(eq(user.email, "owner@example.com"))
    expect(await deps.store.get(body.id as string)).toMatchObject({
      ownerId: account!.id,
      visibility: "unlisted",
      expiresAt: null,
    })
    // Nothing became listed: no cache refresh.
    expect(listed).toBe(0)

    const updated = await personal(key).call("update_lesson", {
      id: body.id,
      patches: [{ op: "set", path: "title", value: "Buttons, ranked" }],
    })
    expect(updated.isError).toBeFalsy()
    expect((await deps.store.get(body.id as string))?.lesson.title).toBe(
      "Buttons, ranked"
    )
    // The public server, signed out, can't touch it.
    const anonymous = await call("update_lesson", {
      id: body.id,
      patches: [{ op: "set", path: "title", value: "Buttons, sorted" }],
    })
    expect(anonymous.isError).toBe(true)
    expect(anonymous.structuredContent).toMatchObject({ error: "unauthorized" })
  })

  it("won't edit another account's lesson, or an anonymous one, without the token", async () => {
    const key = await mcpKeyFor("editor@example.com")
    const other = await call("publish_lesson", { lesson: buttons })
    const id = other.structuredContent.id as string
    const refused = await personal(key).call("update_lesson", {
      id,
      patches: [{ op: "set", path: "title", value: "Mine now" }],
    })
    expect(refused.isError).toBe(true)
    expect(refused.structuredContent).toMatchObject({ error: "unauthorized" })
    expect((await deps.store.get(id))?.lesson.title).not.toBe("Mine now")

    // With the token, keep_lesson on the personal URL saves it to this account, no code needed.
    const kept = await personal(key).call("keep_lesson", {
      id,
      editToken: other.structuredContent.editToken,
    })
    expect(kept.isError).toBeFalsy()
    expect(kept.structuredContent).toMatchObject({
      ok: true,
      id,
      visibility: "public",
    })
    expect(listed).toBe(1)
    // Now it's theirs to edit.
    const mine = await personal(key).call("update_lesson", {
      id,
      patches: [{ op: "set", path: "title", value: "Mine now" }],
    })
    expect(mine.isError).toBeFalsy()
  })

  it("refuses a bad key with 401 and publishes nothing", async () => {
    const before = (await db.select().from(lesson)).length
    for (const key of [
      "learn_mcp_" + "x".repeat(64),
      "nope",
      "learn_" + "x".repeat(64),
    ]) {
      const res = await personal(key).raw("tools/call", {
        name: "publish_lesson",
        arguments: { lesson: buttons },
      })
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({
        ok: false,
        error: "invalid_api_key",
        message: expect.stringContaining("learn.ninja/settings"),
      })
    }
    expect((await db.select().from(lesson)).length).toBe(before)
  })

  it("refuses a terminal key in the URL, and an MCP key as a header", async () => {
    const cookie = await signIn("both@example.com")
    const terminal = await createKey(auth, new Headers({ cookie }), "laptop")
    const res = await personal(terminal.body.key as string).raw("tools/list", {})
    expect(res.status).toBe(401)

    const mcpKey = await mcpKeyFor("both@example.com")
    // /api/keys, /api/account, and the publish API all go through getActor.
    await expect(
      getActor(auth, new Headers({ "x-api-key": mcpKey }))
    ).rejects.toThrow(/chat app/)
    // And Better Auth's own routes refuse it as a session.
    await expect(
      auth.api.listApiKeys({ headers: new Headers({ "x-api-key": mcpKey }) })
    ).rejects.toMatchObject({ status: "FORBIDDEN" })
    await expect(
      auth.api.updateUser({
        headers: new Headers({ "x-api-key": mcpKey }),
        body: { name: "Taken over" },
      })
    ).rejects.toMatchObject({ status: "FORBIDDEN" })
  })

  it("stops working once the URL is rotated or revoked", async () => {
    const cookie = await signIn("rotate@example.com")
    const headers = new Headers({ cookie })
    const first = await connectMcp(auth, headers, (await getActor(auth, headers))!.userId, deps.origin)
    const key1 = (first.body.url as string).split("/mcp/")[1]!
    expect((await personal(key1).raw("tools/list", {})).status).toBe(200)
    const second = await connectMcp(auth, headers, (await getActor(auth, headers))!.userId, deps.origin)
    const key2 = (second.body.url as string).split("/mcp/")[1]!
    expect((await personal(key1).raw("tools/list", {})).status).toBe(401)
    expect((await personal(key2).raw("tools/list", {})).status).toBe(200)
  })

  it("rate-limits by key, not by IP", async () => {
    const key = await mcpKeyFor("busy@example.com")
    deps.limiter = new MemoryRateLimiter(2)
    for (let i = 0; i < 2; i++) {
      const ok = await personal(key).call("publish_lesson", { lesson: buttons })
      expect(ok.isError).toBeFalsy()
    }
    const limited = await personal(key).call("publish_lesson", {
      lesson: buttons,
    })
    expect(limited.structuredContent).toMatchObject({ error: "rate_limited" })
    // The public server from the same IP is a different bucket.
    const anonymous = await call("publish_lesson", { lesson: buttons })
    expect(anonymous.isError).toBeFalsy()
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
