import { randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { connectPglite, session, user, type Db } from "@workspace/db"

import { MemoryRateLimiter } from "@/lib/publish/rate-limit"

import { appCallbackURL, burnAppCode, challengeOf } from "./app-github"
import {
  APP_ORIGIN,
  createAuth,
  productionHostsFromEnv,
  type Auth,
} from "./auth"

// The iOS app's GitHub log-in (app-github.ts) end to end over an in-memory Postgres, with GitHub's
// token and user endpoints stubbed: the start, the callback's hand-off, and the redeem.

const ORIGIN = "http://localhost:3000"
const API = `${ORIGIN}/api/auth`

let db: Db
let auth: Auth
/** The last log-in code "sent" to each address. */
const codes = new Map<string, string>()

beforeAll(async () => {
  db = await connectPglite()
  auth = createAuth({
    db,
    env: {
      NODE_ENV: "test",
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret",
    } as NodeJS.ProcessEnv,
    sendCode: async (email, code) => void codes.set(email, code),
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
        return json({
          // One GitHub account per login, so tests don't share one.
          id: [...login].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) % 1e9,
          login,
          name: login,
          email,
          avatar_url: "",
        })
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

/** The cookies a browser keeps after a response: the last of each name, minus cleared ones. */
function jarAfter(res: Response, before = ""): string {
  const jar = new Map<string, string>()
  for (const pair of before.split("; ").filter(Boolean)) {
    const at = pair.indexOf("=")
    jar.set(pair.slice(0, at), pair.slice(at + 1))
  }
  for (const line of res.headers.getSetCookie()) {
    const [pair, ...attributes] = line.split(";")
    const at = pair!.indexOf("=")
    const name = pair!.slice(0, at)
    const cleared = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a))
    if (cleared) jar.delete(name)
    else jar.set(name, pair!.slice(at + 1))
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ")
}

/** A browser logged in to the website with an email code. */
async function webSession(email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: codes.get(email)! },
    asResponse: true,
  })
  return jarAfter(res)
}

const newVerifier = () => randomBytes(32).toString("base64url")

/** Steps 1 and 2: the sheet's browser starts, goes to GitHub, and comes back. */
async function throughGitHub(challenge: string, browser = "") {
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
      headers: { cookie: jarAfter(start, browser) },
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

describe("after the review", () => {
  it("gives a browser that was logged in its own session back", async () => {
    const browser = await webSession("safari@example.com")
    stubGitHub("octo-dee", "dee@github.test")
    const callback = await throughGitHub(challengeOf(newVerifier()), browser)
    expect(
      new URL(callback.headers.get("location")!).searchParams.get("code")
    ).toBeTruthy()
    const after = jarAfter(callback, browser)
    const me = await auth.api.getSession({
      headers: new Headers({ cookie: after }),
      query: { disableCookieCache: true },
    })
    expect(me?.user.email).toBe("safari@example.com")
  })

  it("leaves a browser that wasn't logged in logged out", async () => {
    stubGitHub("octo-eve", "eve@github.test")
    const callback = await throughGitHub(challengeOf(newVerifier()))
    const after = jarAfter(callback)
    expect(after).not.toMatch(/session_token=/)
  })

  it("burns a code the fallback page was shown", async () => {
    stubGitHub("octo-fay", "fay@github.test")
    const verifier = newVerifier()
    const callback = await throughGitHub(challengeOf(verifier))
    const code = new URL(callback.headers.get("location")!).searchParams.get(
      "code"
    )!
    await burnAppCode(auth, code)
    expect((await redeem(code, verifier)).status).toBe(401)
  })

  it("sends a banned account to the app's error page, not raw JSON", async () => {
    stubGitHub("octo-gus", "gus@github.test")
    await throughGitHub(challengeOf(newVerifier()))
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.email, "gus@github.test"))
    const callback = await throughGitHub(challengeOf(newVerifier()))
    expect(callback.status).toBe(302)
    const to = new URL(callback.headers.get("location")!)
    expect(`${to.protocol}//${to.host}${to.pathname}`).toBe(
      "learnninja://app/signed-in"
    )
    expect(to.searchParams.get("error")).toBe("ACCOUNT_BANNED")
    expect(to.searchParams.has("code")).toBe(false)
  })
})

describe("where the code goes", () => {
  it("is the site's https page in production, the app's scheme on a local server", () => {
    expect(appCallbackURL("https://learn.ninja/api/auth", true)).toBe(
      "https://learn.ninja/app/signed-in"
    )
    expect(appCallbackURL("http://localhost:3000/api/auth", false)).toBe(
      "learnninja://app/signed-in"
    )
    expect(
      appCallbackURL("https://abc.trycloudflare.com/api/auth", false)
    ).toBe("https://abc.trycloudflare.com/app/signed-in")
  })

  it("is never the app's scheme in production, even for a request over http", () => {
    expect(appCallbackURL("http://learn.ninja/api/auth", true)).toBe(
      "https://learn.ninja/app/signed-in"
    )
  })
})

describe("the hosts production answers on", () => {
  it("are the site and this deployment's own Vercel hosts, never all of vercel.app", () => {
    expect(productionHostsFromEnv({} as NodeJS.ProcessEnv)).toEqual([
      "learn.ninja",
      "www.learn.ninja",
    ])
    const preview = productionHostsFromEnv({
      NODE_ENV: "production",
      VERCEL_URL: "learnninja-abc123-uxcellab.vercel.app",
      VERCEL_BRANCH_URL: "learnninja-git-feature-uxcellab.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "learn.ninja",
    } as NodeJS.ProcessEnv)
    expect(preview).toEqual([
      "learn.ninja",
      "www.learn.ninja",
      "learnninja-abc123-uxcellab.vercel.app",
      "learnninja-git-feature-uxcellab.vercel.app",
    ])
    expect(preview.some((host) => host.includes("*"))).toBe(false)
  })
})
