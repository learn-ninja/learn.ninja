import { readFileSync } from "node:fs"

import { eq } from "drizzle-orm"

import { beforeAll, describe, expect, it } from "vitest"

import { connectPglite, user, type Db } from "@workspace/db"

import { publishLesson, claimLesson, type Deps } from "@/lib/publish/handlers"
import { MemoryRateLimiter } from "@/lib/publish/rate-limit"
import { PostgresLessonStore } from "@/lib/publish/store"

import {
  connectMcp,
  createKey,
  deleteKey,
  disconnectMcp,
  listKeys,
  mcpConnection,
  setHandle,
  whoami,
} from "./account"
import { getActor, getActorByKey, InvalidApiKeyError } from "./actor"
import {
  API_KEY_PREFIX,
  createAuth,
  MCP_KEY_PREFIX,
  type Auth,
} from "./auth"
import {
  backfillHandles,
  freeHandle,
  handleProblem,
  HANDLE_ANIMALS,
  HANDLE_TRAITS,
  normalizeHandle,
  randomHandle,
  randomHandleName,
} from "./handles"
import { safeCallback } from "./session"

// Better Auth over an in-memory Postgres: the email code flow the CLI and the log-in page use,
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
  it("signs a new user in with a six-digit code and creates the account, with a random handle", async () => {
    const cookie = await signIn("ada@example.com")
    const actor = await getActor(auth, new Headers({ cookie }))
    expect(actor).toMatchObject({
      email: "ada@example.com",
      handle: expect.stringMatching(/^[a-z]+-[a-z]+$/),
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
    expect(created.body.start).toBe(key.slice(0, MCP_KEY_PREFIX.length + 4))

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

  it("keeps the MCP key apart from the terminal keys", async () => {
    const cookie = await signIn("chat@example.com")
    const headers = new Headers({ cookie })
    const { userId } = (await getActor(auth, headers))!
    expect(await mcpConnection(auth, headers)).toBeNull()

    const made = await connectMcp(auth, headers, userId, "https://learn.test")
    expect(made.status).toBe(201)
    const url = made.body.url as string
    expect(url).toMatch(/^https:\/\/learn\.test\/mcp\/learn_mcp_/)
    const key = url.split("/mcp/")[1]!
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(made.body.start).toBe(key.slice(0, MCP_KEY_PREFIX.length + 4))

    // The settings page sees it, masked, and never among the terminal keys.
    expect(await mcpConnection(auth, headers)).toEqual({
      id: made.body.id,
      start: made.body.start,
      createdAt: made.body.createdAt,
      lastUsedAt: null,
    })
    const terminal = await createKey(auth, headers, "laptop")
    expect((await listKeys(auth, headers)).body.keys).toEqual([
      expect.objectContaining({ id: terminal.body.id }),
    ])
    expect(JSON.stringify(await listKeys(auth, headers))).not.toContain(key)

    // It stands for the account on its own URL, and nowhere else.
    expect(await getActorByKey(auth, db, key)).toMatchObject({
      userId,
      email: "chat@example.com",
      viaApiKey: true,
      via: "key",
      limitKey: expect.stringMatching(/^key:/),
    })
    await expect(getActorByKey(auth, db, terminal.body.key as string)).rejects.toBeInstanceOf(
      InvalidApiKeyError
    )
    await expect(
      getActor(auth, new Headers({ "x-api-key": key }))
    ).rejects.toBeInstanceOf(InvalidApiKeyError)
    await expect(
      auth.api.createApiKey({
        headers: new Headers({ "x-api-key": key }),
        body: { name: "second" },
      })
    ).rejects.toMatchObject({ status: "FORBIDDEN" })
    await expect(
      auth.api.deleteApiKey({
        headers: new Headers({ "x-api-key": key }),
        body: { keyId: terminal.body.id as string },
      })
    ).rejects.toMatchObject({ status: "FORBIDDEN" })
    // Using it counts as a request on the key.
    expect((await mcpConnection(auth, headers))?.lastUsedAt).toEqual(
      expect.any(String)
    )

    // Revoking it from the settings leaves the terminal key alone.
    expect((await disconnectMcp(auth, headers)).status).toBe(200)
    expect(await mcpConnection(auth, headers)).toBeNull()
    await expect(getActorByKey(auth, db, key)).rejects.toBeInstanceOf(
      InvalidApiKeyError
    )
    expect(
      await getActor(auth, new Headers({ "x-api-key": terminal.body.key as string }))
    ).toMatchObject({ userId })
  })

  it("refuses a banned account's open session and API key", async () => {
    const cookie = await signIn("banned@example.com")
    const created = await createKey(auth, new Headers({ cookie }), "laptop")
    const key = created.body.key as string
    const { userId } = (await getActor(auth, new Headers({ cookie })))!
    await db.update(user).set({ banned: true }).where(eq(user.id, userId))

    // The session token alone, as the server sees it once the five-minute cookie cache runs out.
    const token = cookie.split("; ").find((c) => c.includes("session_token"))!
    expect(await getActor(auth, new Headers({ cookie: token }))).toBeNull()
    await expect(
      getActor(auth, new Headers({ "x-api-key": key }))
    ).rejects.toBeInstanceOf(InvalidApiKeyError)
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
    // So does a fresh log-in.
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

  it("makes random handles that follow the rules, and finds a free one", async () => {
    for (const trait of HANDLE_TRAITS)
      for (const animal of HANDLE_ANIMALS)
        expect(handleProblem(`${trait}-${animal}`)).toBeNull()
    expect(randomHandleName(() => 0)).toBe("quiet-kitsune")
    expect(randomHandleName(() => 0.999)).toBe("dawn-kani")
    // Always the same pair, so once it's taken the fallback is numbered. (Sign-ups elsewhere in
    // this file get random handles, so "quiet-kitsune" may be taken already.)
    const first = await randomHandle(db, () => 0)
    expect(first).toMatch(/^quiet-kitsune(-\d+)?$/)
    await db
      .insert(user)
      .values({ id: "rh1", name: "R", email: "rh1@example.com", handle: first })
    const next = await randomHandle(db, () => 0)
    expect(next).toMatch(/^quiet-kitsune-\d+$/)
    expect(next).not.toBe(first)
  })

  it("gives accounts without a handle a random one, only with write", async () => {
    await db
      .insert(user)
      .values(["bf1", "bf2"].map((id) => ({ id, name: id, email: `${id}@example.com` })))
    const handleOf = async (id: string) =>
      (await db.select().from(user).where(eq(user.id, id)))[0]!.handle
    const dry = await backfillHandles(db)
    expect(dry.map((g) => g.id)).toEqual(expect.arrayContaining(["bf1", "bf2"]))
    expect(new Set(dry.map((g) => g.handle)).size).toBe(dry.length)
    expect(await handleOf("bf1")).toBeNull()
    const written = await backfillHandles(db, { write: true })
    expect(await handleOf("bf1")).toBe(written.find((g) => g.id === "bf1")!.handle)
    expect(await backfillHandles(db)).toEqual([])
  })

  it("only sends the browser to site paths after logging in", () => {
    expect(safeCallback("/keep/abc")).toBe("/keep/abc")
    expect(safeCallback(["/settings", "/x"])).toBe("/settings")
    expect(safeCallback(undefined)).toBe("/explore")
    expect(safeCallback("https://evil.com")).toBe("/explore")
    expect(safeCallback("//evil.com")).toBe("/explore")
    expect(safeCallback("/\\evil.com")).toBe("/explore")
  })
})

describe("with Redis holding sessions", () => {
  it("starts, and logs in, with a secondary storage like production", async () => {
    // The OAuth provider refuses to start with a secondary storage unless sessions are also kept
    // in the database; a missing flag only showed on Vercel, as every discovery route answered 500.
    const memory = new Map<string, string>()
    const redisLike = createAuth({
      db,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      sendCode: async (email, code) => {
        codes.set(email, code)
      },
      codeLimiter: new MemoryRateLimiter(100),
      storage: {
        get: async (key) => memory.get(key) ?? null,
        getAndDelete: async (key) => {
          const value = memory.get(key) ?? null
          memory.delete(key)
          return value
        },
        set: async (key, value) => {
          memory.set(key, value)
        },
        delete: async (key) => {
          memory.delete(key)
        },
        increment: async (key) => {
          const n = Number(memory.get(key) ?? 0) + 1
          memory.set(key, String(n))
          return n
        },
      },
    })
    await redisLike.$context
    const email = "redis@example.com"
    await redisLike.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
    const res = await redisLike.api.signInEmailOTP({
      body: { email, otp: codes.get(email)! },
      asResponse: true,
    })
    expect(res.status).toBe(200)
    const metadata = await redisLike.handler(
      new Request(`${ORIGIN}/api/auth/.well-known/oauth-authorization-server`)
    )
    expect(metadata.status).toBe(200)
  })
})

describe("the reviewers' test account", () => {
  it("logs in with the fixed code and gets no email; everyone else is unchanged", async () => {
    const sent: string[] = []
    const reviewed = createAuth({
      db,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      sendCode: async (email, code) => {
        sent.push(email)
        codes.set(email, code)
      },
      codeLimiter: new MemoryRateLimiter(100),
      reviewLogin: { email: "reviewer@example.com", code: "246810" },
    })
    await reviewed.api.sendVerificationOTP({
      body: { email: "Reviewer@example.com", type: "sign-in" },
    })
    expect(sent).toEqual([])
    const wrong = await reviewed.api.signInEmailOTP({
      body: { email: "reviewer@example.com", otp: "000000" },
      asResponse: true,
    })
    expect(wrong.status).not.toBe(200)
    const ok = await reviewed.api.signInEmailOTP({
      body: { email: "reviewer@example.com", otp: "246810" },
      asResponse: true,
    })
    expect(ok.status).toBe(200)

    await reviewed.api.sendVerificationOTP({
      body: { email: "someone@example.com", type: "sign-in" },
    })
    expect(sent).toEqual(["someone@example.com"])
    expect(codes.get("someone@example.com")).not.toBe("246810")
  })

  it("is off unless both variables are set and the code has six digits", async () => {
    const { reviewLoginFromEnv } = await import("./auth")
    const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv
    expect(reviewLoginFromEnv(env({}))).toBeNull()
    expect(reviewLoginFromEnv(env({ REVIEW_SIGN_IN_EMAIL: "r@example.com" }))).toBeNull()
    expect(
      reviewLoginFromEnv(
        env({ REVIEW_SIGN_IN_EMAIL: "r@example.com", REVIEW_SIGN_IN_CODE: "12" })
      )
    ).toBeNull()
    expect(
      reviewLoginFromEnv(
        env({ REVIEW_SIGN_IN_EMAIL: " R@Example.com ", REVIEW_SIGN_IN_CODE: "123456" })
      )
    ).toEqual({ email: "r@example.com", code: "123456" })
  })
})
