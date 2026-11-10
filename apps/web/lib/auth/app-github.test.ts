import { randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { connectPglite, session, user, type Db } from "@workspace/db"

import { MemoryRateLimiter } from "@/lib/publish/rate-limit"

import { appCallbackURL, challengeOf } from "./app-github"
import { APP_ORIGIN, createAuth, type Auth } from "./auth"

// The iOS app's GitHub log-in (app-github.ts) end to end over an in-memory Postgres, with GitHub's
// token and user endpoints stubbed: the start, the callback's hand-off, and the redeem.

const ORIGIN = "http://localhost:3000"
const API = `${ORIGIN}/api/auth`

let db: Db
let auth: Auth

beforeAll(async () => {
  db = await connectPglite()
  auth = createAuth({
    db,
    env: {
      NODE_ENV: "test",
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret",
    } as NodeJS.ProcessEnv,
    sendCode: async () => {},
    codeLimiter: new MemoryRateLimiter(100),
  })
}, 30_000)

afterEach(() => vi.unstubAllGlobals())

/** GitHub, as Better Auth's provider calls it, for one account. */
function stubGitHub(login: string, email: string) {
  const real = globalThis.fetch
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        })
      if (url.startsWith("https://github.com/login/oauth/access_token"))
        return json({
          access_token: "gho_test",
          token_type: "bearer",
          scope: "",
        })
      if (url === "https://api.github.com/user")
        return json({ id: 4242, login, name: login, email, avatar_url: "" })
      if (url === "https://api.github.com/user/emails")
        return json([{ email, primary: true, verified: true }])
      return real(input, init)
    }
  )
}

const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")

const newVerifier = () => randomBytes(32).toString("base64url")

/** Steps 1 and 2: the sheet's browser starts, goes to GitHub, and comes back. */
async function throughGitHub(challenge: string) {
  const start = await auth.handler(
    new Request(`${API}/app/github/start?challenge=${challenge}`)
  )
  expect(start.status).toBe(302)
  const authorize = new URL(start.headers.get("location")!)
  expect(authorize.origin + authorize.pathname).toBe(
    "https://github.com/login/oauth/authorize"
  )
  const state = authorize.searchParams.get("state")!
  const callback = await auth.handler(
    new Request(`${API}/callback/github?code=gh-code&state=${state}`, {
      headers: { cookie: cookiesOf(start) },
    })
  )
  return callback
}

async function redeem(code: string, verifier: string) {
  return auth.handler(
    new Request(`${API}/app/github/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_ORIGIN },
      body: JSON.stringify({ code, verifier }),
    })
  )
}

describe("GitHub log-in for the iOS app", () => {
  it("hands the app a one-time code, and its own session for the code and verifier", async () => {
    stubGitHub("octo-ada", "ada@github.test")
    const verifier = newVerifier()
    const callback = await throughGitHub(challengeOf(verifier))
    expect(callback.status).toBe(302)
    const to = new URL(callback.headers.get("location")!)
    expect(`${to.protocol}//${to.host}${to.pathname}`).toBe(
      "learnninja://app/signed-in"
    )
    const code = to.searchParams.get("code")!
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/)

    // The browser isn't left logged in: no session row, and the cookie is cleared.
    const [row] = await db
      .select({ id: user.id, handle: user.handle })
      .from(user)
      .where(eq(user.email, "ada@github.test"))
    expect(row?.handle).toBe("octo-ada")
    expect(
      await db.select().from(session).where(eq(session.userId, row!.id))
    ).toHaveLength(0)

    const res = await redeem(code, verifier)
    expect(res.status).toBe(200)
    const cookie = cookiesOf(res)
    expect(cookie).toContain("session_token")
    const me = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(me?.user.email).toBe("ada@github.test")

    // Single use.
    expect((await redeem(code, verifier)).status).toBe(401)
  })

  it("refuses a code without the verifier its challenge came from, and burns it", async () => {
    stubGitHub("octo-bob", "bob@github.test")
    const verifier = newVerifier()
    const callback = await throughGitHub(challengeOf(verifier))
    const code = new URL(callback.headers.get("location")!).searchParams.get(
      "code"
    )!
    expect((await redeem(code, newVerifier())).status).toBe(401)
    expect((await redeem(code, verifier)).status).toBe(401)
  })

  it("refuses a start without a well-formed challenge", async () => {
    for (const challenge of ["", "short", "x".repeat(42) + "!"]) {
      const res = await auth.handler(
        new Request(`${API}/app/github/start?challenge=${challenge}`)
      )
      expect(res.status).toBe(400)
    }
  })

  it("leaves the website's own GitHub log-in alone", async () => {
    stubGitHub("octo-cy", "cy@github.test")
    const start = await auth.handler(
      new Request(`${API}/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ provider: "github", callbackURL: "/settings" }),
      })
    )
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")!
    const callback = await auth.handler(
      new Request(`${API}/callback/github?code=gh-code&state=${state}`, {
        headers: { cookie: cookiesOf(start) },
      })
    )
    expect(callback.headers.get("location")).toBe("/settings")
    expect(cookiesOf(callback)).toMatch(/session_token=[^;]+/)
  })

  it("keeps Better Auth's open proxy for the app switched off", async () => {
    const res = await auth.handler(
      new Request(
        `${API}/expo-authorization-proxy?authorizationURL=${encodeURIComponent("https://evil.test/")}`
      )
    )
    expect(res.status).toBe(404)
  })
})

describe("where the code goes", () => {
  it("is the site's https page in production, the app's scheme on a local server", () => {
    expect(appCallbackURL("https://learn.ninja/api/auth")).toBe(
      "https://learn.ninja/app/signed-in"
    )
    expect(appCallbackURL("http://localhost:3000/api/auth")).toBe(
      "learnninja://app/signed-in"
    )
  })
})
