import { readFileSync } from "node:fs"

import { beforeAll, describe, expect, it } from "vitest"

import { connectPglite, type Db } from "@workspace/db"

import { publishLesson, claimLesson, type Deps } from "@/lib/publish/handlers"
import { MemoryRateLimiter } from "@/lib/publish/rate-limit"
import { PostgresLessonStore } from "@/lib/publish/store"

import { createKey, deleteKey, listKeys, setHandle, whoami } from "./account"
import { getActor, InvalidApiKeyError } from "./actor"
import { API_KEY_PREFIX, createAuth, type Auth } from "./auth"
import { freeHandle, handleProblem, normalizeHandle } from "./handles"
import { safeCallback } from "./session"

// Better Auth over an in-memory Postgres: the email code flow the CLI and the sign-in page use,
// API keys as sessions, and handles.

const buttons = readFileSync(
  new URL("../../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

let db: Db
let auth: Auth
let deps: Deps
/** The last code "sent" to each address. */
const codes = new Map<string, string>()
const ORIGIN = "http://localhost:3000"

beforeAll(async () => {
  db = await connectPglite()
  auth = createAuth({
    db,
    env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    sendCode: async (email, code) => {
      codes.set(email, code)
    },
    codeLimiter: new MemoryRateLimiter(100),
  })
  deps = {
    store: new PostgresLessonStore(db),
    limiter: new MemoryRateLimiter(100),
    origin: ORIGIN,
  }
}, 30_000)

/** Signs `email` in with a code, as the CLI does, and returns the session cookie. */
async function signIn(email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
  const otp = codes.get(email)!
  expect(otp).toMatch(/^\d{6}$/)
  const res = await auth.api.signInEmailOTP({
    body: { email, otp },
    asResponse: true,
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  expect(cookie).toContain("session_token")
  return cookie
}

describe("email codes", () => {
  it("signs a new user in with a six-digit code and creates the account", async () => {
    const cookie = await signIn("ada@example.com")
    const actor = await getActor(auth, new Headers({ cookie }))
    expect(actor).toMatchObject({
      email: "ada@example.com",
      handle: null,
      viaApiKey: false,
    })
  })

  it("rejects a wrong code", async () => {
    const email = "bob@example.com"
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
    const wrong = codes.get(email) === "000000" ? "111111" : "000000"
    await expect(
      auth.api.signInEmailOTP({ body: { email, otp: wrong } })
    ).rejects.toMatchObject({ status: "BAD_REQUEST" })
  })

  it("stops sending codes to one address after the limit", async () => {
    const limited = createAuth({
      db,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      sendCode: async () => {},
      codeLimiter: new MemoryRateLimiter(1),
    })
    const body = { email: "spam@example.com", type: "sign-in" as const }
    await limited.api.sendVerificationOTP({ body })
    await expect(limited.api.sendVerificationOTP({ body })).rejects.toMatchObject(
      { status: "TOO_MANY_REQUESTS" }
    )
  })

  it("stores codes hashed", async () => {
    const email = "hash@example.com"
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
    const { verification } = await import("@workspace/db")
    const rows = await db.select().from(verification)
    const mine = rows.filter((r) => r.identifier.includes(email))
    expect(mine.length).toBeGreaterThan(0)
    for (const row of mine) expect(row.value).not.toContain(codes.get(email)!)
  })
})

describe("API keys", () => {
  it("creates a key for a session and reads it back as that user", async () => {
    const cookie = await signIn("cli@example.com")
    const headers = new Headers({ cookie })
    const created = await createKey(auth, headers, "my laptop")
    expect(created.status).toBe(201)
    const key = created.body.key as string
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(created.body.start).toBe(key.slice(0, API_KEY_PREFIX.length + 4))

    const actor = await getActor(auth, new Headers({ "x-api-key": key }))
    expect(actor).toMatchObject({ email: "cli@example.com", viaApiKey: true })

    const listed = await listKeys(auth, headers)
    expect(listed.body.keys).toEqual([
      expect.objectContaining({ name: "my laptop", start: created.body.start }),
    ])
    expect(JSON.stringify(listed.body)).not.toContain(key)

    // The key may revoke itself (`learn logout`), after which it no longer works.
    const revoked = await deleteKey(
      auth,
      new Headers({ "x-api-key": key }),
      created.body.id as string
    )
    expect(revoked.status).toBe(200)
    await expect(
      getActor(auth, new Headers({ "x-api-key": key }))
    ).rejects.toBeInstanceOf(InvalidApiKeyError)
  })

  it("won't let a key mint keys, even through Better Auth's own route", async () => {
    const cookie = await signIn("minter@example.com")
    const created = await createKey(auth, new Headers({ cookie }), "first")
    const key = created.body.key as string
    await expect(
      auth.api.createApiKey({
        headers: new Headers({ "x-api-key": key }),
        body: { name: "second" },
      })
    ).rejects.toMatchObject({ status: "FORBIDDEN" })
    // The key still works for everything else.
    expect(await getActor(auth, new Headers({ "x-api-key": key }))).toMatchObject({
      email: "minter@example.com",
    })
  })

  it("refuses a made-up key instead of treating the request as anonymous", async () => {
    await expect(
      getActor(auth, new Headers({ "x-api-key": "learn_" + "x".repeat(64) }))
    ).rejects.toBeInstanceOf(InvalidApiKeyError)
    await expect(
      getActor(auth, new Headers({ "x-api-key": "short" }))
    ).rejects.toBeInstanceOf(InvalidApiKeyError)
  })

  it("treats a request with no cookie and no key as anonymous", async () => {
    expect(await getActor(auth, new Headers())).toBeNull()
    expect(
      await getActor(auth, new Headers({ cookie: "theme=dark" }))
    ).toBeNull()
  })

  it("publishes an owned lesson with a key, and it never expires", async () => {
    const cookie = await signIn("owner@example.com")
    const created = await createKey(auth, new Headers({ cookie }), "ci")
    const actor = await getActor(
      auth,
      new Headers({ "x-api-key": created.body.key as string })
    )
    const reply = await publishLesson(
      { text: buttons, client: "x", ownerId: actor!.userId },
      deps
    )
    expect(reply.status).toBe(201)
    expect(reply.body).toMatchObject({ owned: true, expiresAt: null })
    expect(reply.body).not.toHaveProperty("claimToken")
    const stored = await deps.store.get(reply.body.id as string)
    expect(stored).toMatchObject({
      ownerId: actor!.userId,
      expiresAt: null,
      claimTokenHash: null,
    })
  })

  it("claims an anonymous lesson with the key (what `learn login` does)", async () => {
    const cookie = await signIn("keeper@example.com")
    const created = await createKey(auth, new Headers({ cookie }), "ci")
    const actor = await getActor(
      auth,
      new Headers({ "x-api-key": created.body.key as string })
    )
    const published = await publishLesson({ text: buttons, client: "x" }, deps)
    const claimed = await claimLesson(
      {
        id: published.body.id as string,
        claimToken: published.body.claimToken as string,
        ownerId: actor!.userId,
      },
      deps
    )
    expect(claimed).toMatchObject({
      status: 200,
      body: { ok: true, url: published.body.url, expiresAt: null },
    })
    expect(await deps.store.get(published.body.id as string)).toMatchObject({
      ownerId: actor!.userId,
      expiresAt: null,
      claimTokenHash: null,
    })
  })
})

describe("handles", () => {
  it("normalizes and checks handles", () => {
    expect(normalizeHandle("@Colin_Pace ")).toBe("colin-pace")
    expect(handleProblem("colin-pace")).toBeNull()
    expect(handleProblem("ab")).toMatch(/3 to 30/)
    expect(handleProblem("-nope")).toMatch(/3 to 30/)
    expect(handleProblem("settings")).toMatch(/reserved/)
  })

  it("sets a handle once, refuses a taken one, and reports it in whoami", async () => {
    const a = new Headers({ cookie: await signIn("h1@example.com") })
    const b = new Headers({ cookie: await signIn("h2@example.com") })
    const set = await setHandle(auth, a, "Ada Lovelace")
    expect(set.body).toMatchObject({ ok: true, handle: "ada-lovelace" })
    // The reply refreshes the session cookie, whose cached copy of the user had no handle.
    const refreshed = set.headers!.getSetCookie().map((c) => c.split(";")[0])
    expect(refreshed.join()).toContain("session_data")
    a.set("cookie", refreshed.join("; "))
    expect(await setHandle(auth, b, "ada-lovelace")).toMatchObject({
      status: 409,
      body: { error: "handle_taken" },
    })
    expect(await setHandle(auth, b, "api")).toMatchObject({
      status: 422,
      body: { error: "invalid_handle" },
    })
    // The same user may keep their own handle.
    expect((await setHandle(auth, a, "ada-lovelace")).status).toBe(200)
    // The session (and its cookie cache) sees the new handle at once.
    expect(whoami((await getActor(auth, a))!).body).toMatchObject({
      email: "h1@example.com",
      handle: "ada-lovelace",
    })
    // So does a fresh sign-in.
    const again = (await getActor(
      auth,
      new Headers({ cookie: await signIn("h1@example.com") })
    ))!
    expect(again.handle).toBe("ada-lovelace")
  })

  it("refuses a bad handle sent straight to Better Auth's update-user", async () => {
    const headers = new Headers({ cookie: await signIn("h3@example.com") })
    await expect(
      auth.api.updateUser({ headers, body: { handle: "ada-lovelace" } })
    ).rejects.toMatchObject({ status: "CONFLICT" })
    await expect(
      auth.api.updateUser({ headers, body: { handle: "x" } })
    ).rejects.toMatchObject({ status: "UNPROCESSABLE_ENTITY" })
    // Other updates still go through.
    await auth.api.updateUser({ headers, body: { name: "H3" } })
  })

  it("finds a free handle near a GitHub login", async () => {
    expect(await freeHandle(db, "Ada_Lovelace")).toBe("ada-lovelace-2")
    expect(await freeHandle(db, "someone-new")).toBe("someone-new")
    expect(await freeHandle(db, "settings")).toBe("settings-1")
    // "ninja" itself is reserved, so the fallback is numbered.
    expect(await freeHandle(db, "___")).toBe("ninja-1")
    expect(await freeHandle(db, "ab")).toBe("ab0")
  })

  it("only sends the browser to site paths after signing in", () => {
    expect(safeCallback("/keep/abc")).toBe("/keep/abc")
    expect(safeCallback(["/settings", "/x"])).toBe("/settings")
    expect(safeCallback(undefined)).toBe("/settings")
    expect(safeCallback("https://evil.com")).toBe("/settings")
    expect(safeCallback("//evil.com")).toBe("/settings")
    expect(safeCallback("/\\evil.com")).toBe("/settings")
  })
})
