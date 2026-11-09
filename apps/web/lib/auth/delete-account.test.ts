import { readFileSync } from "node:fs"

import { eq } from "drizzle-orm"

import { beforeAll, describe, expect, it } from "vitest"

import {
  account,
  activityDay,
  apikey,
  avatar,
  completion,
  connectPglite,
  lesson,
  lessonProgress,
  like,
  oauthClient,
  oauthConsent,
  session,
  user,
  type Db,
} from "@workspace/db"

import { DELETE } from "@/app/api/account/route"
import { publishLesson, type Deps } from "@/lib/publish/handlers"
import { MemoryRateLimiter } from "@/lib/publish/rate-limit"
import { PostgresLessonStore } from "@/lib/publish/store"

import { connectMcp, createKey, deleteAccount } from "./account"
import { getActor, type Actor } from "./actor"
import { createAuth, type Auth } from "./auth"

// DELETE /api/account: the account and everything it owns go; nobody else's things do.

const buttons = readFileSync(
  new URL("../../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

let db: Db
let auth: Auth
let deps: Deps
const codes = new Map<string, string>()

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
    origin: "http://localhost:3000",
  }
}, 30_000)

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

async function owned(userId: string): Promise<string> {
  const reply = await publishLesson(
    { text: buttons, client: "x", ownerId: userId },
    deps
  )
  return reply.body.id as string
}

/** A signed-in learner with one of everything an account can have. */
async function fullAccount(email: string, other: string) {
  const cookie = await signIn(email)
  const headers = new Headers({ cookie })
  const actor = (await getActor(auth, headers))!
  const id = actor.userId
  const mine = await owned(id)
  await createKey(auth, headers, "laptop")
  await connectMcp(auth, headers, id, "https://learn.test")
  await db
    .insert(avatar)
    .values({ id: `av-${id}`, userId: id, data: Buffer.from([1]) })
  await db
    .update(user)
    .set({ image: `/avatars/av-${id}` })
    .where(eq(user.id, id))
  // GitHub linked: an account row (the email code needs none).
  await db.insert(account).values({
    id: `gh-${id}`,
    accountId: `gh-${id}`,
    providerId: "github",
    userId: id,
    updatedAt: new Date(),
  })
  await db.insert(like).values({ userId: id, lessonId: other })
  await db.update(lesson).set({ likes: 1 }).where(eq(lesson.id, other))
  await db.insert(completion).values({ userId: id, lessonId: other })
  await db
    .insert(lessonProgress)
    .values([{ userId: id, lessonId: mine, done: 1, total: 5 }])
  await db
    .insert(activityDay)
    .values({ userId: id, day: "2026-11-01", lessons: 2 })
  const clientId = `client-${id}`
  await db.insert(oauthClient).values({
    id: clientId,
    clientId,
    userId: id,
    redirectUris: ["https://example.com/cb"],
  })
  await db.insert(oauthConsent).values({
    id: `consent-${id}`,
    clientId,
    userId: id,
    scopes: ["lessons"],
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return { cookie, headers, actor, mine }
}

const rowsOf = async (id: string) => ({
  user: await db.select().from(user).where(eq(user.id, id)),
  sessions: await db.select().from(session).where(eq(session.userId, id)),
  accounts: await db.select().from(account).where(eq(account.userId, id)),
  keys: await db.select().from(apikey).where(eq(apikey.referenceId, id)),
  lessons: await db.select().from(lesson).where(eq(lesson.ownerId, id)),
  likes: await db.select().from(like).where(eq(like.userId, id)),
  completions: await db
    .select()
    .from(completion)
    .where(eq(completion.userId, id)),
  progress: await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, id)),
  days: await db.select().from(activityDay).where(eq(activityDay.userId, id)),
  avatars: await db.select().from(avatar).where(eq(avatar.userId, id)),
  clients: await db
    .select()
    .from(oauthClient)
    .where(eq(oauthClient.userId, id)),
  consents: await db
    .select()
    .from(oauthConsent)
    .where(eq(oauthConsent.userId, id)),
})

describe("deleting the account", () => {
  it("deletes the account and everything it owns, ends its sessions, and leaves others alone", async () => {
    const otherCookie = await signIn("stays@example.com")
    const stays = (await getActor(auth, new Headers({ cookie: otherCookie })))!
    const theirs = await owned(stays.userId)
    const goes = await fullAccount("goes@example.com", theirs)
    // The one who stays has things of their own on the leaving account's lesson.
    await db
      .insert(completion)
      .values({ userId: stays.userId, lessonId: goes.mine })

    const before = await rowsOf(goes.actor.userId)
    for (const [table, rows] of Object.entries(before)) {
      expect(rows.length, table).toBeGreaterThan(0)
    }
    const othersBefore = await rowsOf(stays.userId)

    const reply = await deleteAccount(
      auth,
      db,
      goes.actor,
      goes.headers,
      "  Goes@Example.com "
    )
    expect(reply).toMatchObject({
      status: 200,
      body: { ok: true, deleted: true },
    })
    // The reply clears the session cookie.
    expect(reply.headers?.getSetCookie().join("\n")).toMatch(/session_token=;/)

    const after = await rowsOf(goes.actor.userId)
    for (const [table, rows] of Object.entries(after)) {
      expect(rows, table).toEqual([])
    }
    // Their lesson is gone, not left behind as an anonymous one.
    expect(await deps.store.get(goes.mine)).toBeNull()
    // The old session token is no longer anyone. (A copy of the whole cookie would still pass the
    // signed cookie cache for its five minutes, as a ban does; the reply clears it.)
    const token = goes.cookie
      .split("; ")
      .filter((c) => c.includes("session_token="))
      .join("; ")
    expect(await getActor(auth, new Headers({ cookie: token }))).toBeNull()

    // The other account: untouched, except their finish on the deleted lesson, which went with it,
    // and their lesson's like count, which lost the deleted account's like.
    const othersAfter = await rowsOf(stays.userId)
    expect(othersAfter.user).toEqual(othersBefore.user)
    expect(othersAfter.sessions).toEqual(othersBefore.sessions)
    expect(othersAfter.lessons.map((l) => l.id)).toEqual([theirs])
    expect(othersAfter.lessons[0]!.likes).toBe(0)
    expect(othersAfter.completions).toEqual([])
    expect(
      await getActor(auth, new Headers({ cookie: otherCookie }))
    ).toMatchObject({
      userId: stays.userId,
    })
  })

  it("refuses without the account's email typed to confirm, and deletes nothing", async () => {
    const cookie = await signIn("careful@example.com")
    const headers = new Headers({ cookie })
    const actor = (await getActor(auth, headers))!
    for (const confirm of [undefined, "", "someone@example.com", true]) {
      const reply = await deleteAccount(auth, db, actor, headers, confirm)
      expect(reply).toMatchObject({
        status: 400,
        body: { ok: false, error: "confirm_mismatch" },
      })
    }
    expect(await getActor(auth, headers)).toMatchObject({
      userId: actor.userId,
    })
  })

  it("refuses an API key: only a logged-in session can delete the account", async () => {
    const cookie = await signIn("keyed@example.com")
    const created = await createKey(auth, new Headers({ cookie }), "ci")
    const headers = new Headers({ "x-api-key": created.body.key as string })
    const actor = (await getActor(auth, headers)) as Actor
    expect(actor.viaApiKey).toBe(true)
    const reply = await deleteAccount(auth, db, actor, headers, actor.email)
    expect(reply).toMatchObject({ status: 403, body: { error: "forbidden" } })
    expect(
      await db.select().from(user).where(eq(user.id, actor.userId))
    ).toHaveLength(1)
  })

  it("answers a signed-out request with 401", async () => {
    const res = await DELETE(
      new Request("http://localhost:3000/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirm: "anyone@example.com" }),
      })
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "sign_in_required" })
  })
})
