import { createHash, randomBytes } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { readFileSync } from "node:fs"

import { createMcpProtectedRequestHandler } from "@better-auth/mcp"
import { eq } from "drizzle-orm"

import { connectPglite, oauthConsent, user, type Db } from "@workspace/db"

import { connectedApps, disconnectApp } from "../auth/account"
import { createAuth, MCP_SCOPE, type Auth } from "../auth/auth"
import { handleOf } from "../auth/handles"
import { MemoryRateLimiter } from "../publish/rate-limit"
import { PostgresLessonStore } from "../publish/store"
import { skillBundle } from "../skill-files"
import { PostgresDraftStore } from "./drafts"
import { callsProtectedTool, gateMcp } from "./gate"
import { createLearnMcp, type McpDeps } from "./server"

// The OAuth server chat apps log in through, end to end against PGlite: discovery, the authorize
// → log-in → consent → token flow a client like Claude runs, and the token's verification by the
// MCP route's gate.

const SITE = "https://learn.test"
const ISSUER = `${SITE}/api/auth`
const RESOURCE = `${SITE}/mcp`
const REDIRECT = "https://claude.ai/api/mcp/auth_callback"

let db: Db
let auth: Auth
const codes = new Map<string, string>()
const realFetch = globalThis.fetch

beforeAll(async () => {
  db = await connectPglite()
  auth = createAuth({
    db,
    env: { NODE_ENV: "test", BETTER_AUTH_URL: ISSUER } as NodeJS.ProcessEnv,
    sendCode: async (email, code) => {
      codes.set(email, code)
    },
    codeLimiter: new MemoryRateLimiter(100),
    resource: RESOURCE,
  })
  // The token verifier fetches the signing keys over HTTP; in tests, learn.test is this instance.
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(SITE)) return auth.handler(new Request(url, init))
    return realFetch(input, init)
  })
}, 30_000)

afterAll(() => vi.unstubAllGlobals())

/** A request to this site, handled by Better Auth as the Next route would. */
const get = (path: string, headers: Record<string, string> = {}) =>
  auth.handler(new Request(SITE + path, { headers, redirect: "manual" }))

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

const b64url = (buf: Buffer) => buf.toString("base64url")
const pkce = () => {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

/** Registers a client the way an app without a Client ID Metadata Document would. */
async function registerClient(): Promise<string> {
  const res = await auth.handler(
    new Request(`${ISSUER}/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Test chat app",
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    })
  )
  expect(res.status, await res.clone().text()).toBe(201)
  return ((await res.json()) as { client_id: string }).client_id
}

function authorizeUrl(clientId: string, challenge: string, state = "s1") {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: `openid offline_access ${MCP_SCOPE}`,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  })
  return `/api/auth/oauth2/authorize?${q}`
}

const location = (res: Response) => {
  expect([302, 303, 307]).toContain(res.status)
  return new URL(res.headers.get("location")!, SITE)
}

describe("discovery", () => {
  it("names the MCP server and its scope in the protected resource metadata", async () => {
    for (const path of [
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-protected-resource",
    ]) {
      const res = await get(path)
      expect(res.status, path).toBe(200)
      const doc = await res.json()
      expect(doc.resource).toBe(RESOURCE)
      expect(doc.authorization_servers).toEqual([ISSUER])
      expect(doc.scopes_supported).toEqual([MCP_SCOPE])
    }
  })

  it("serves the authorization server metadata at both well-known forms, with what Claude checks", async () => {
    for (const path of [
      "/.well-known/oauth-authorization-server/api/auth",
      "/api/auth/.well-known/oauth-authorization-server",
    ]) {
      const res = await get(path)
      expect(res.status, path).toBe(200)
      const doc = await res.json()
      expect(doc.issuer).toBe(ISSUER)
      expect(doc.authorization_endpoint).toBe(`${ISSUER}/oauth2/authorize`)
      expect(doc.token_endpoint).toBe(`${ISSUER}/oauth2/token`)
      expect(doc.code_challenge_methods_supported).toEqual(["S256"])
      expect(doc.client_id_metadata_document_supported).toBe(true)
      expect(doc.token_endpoint_auth_methods_supported).toContain("none")
      expect(doc.registration_endpoint).toBe(`${ISSUER}/oauth2/register`)
      expect(doc.scopes_supported).toEqual(
        expect.arrayContaining(["openid", "offline_access", MCP_SCOPE])
      )
    }
  })
})

describe("logging in from a chat app", () => {
  it("sends a logged-out user to /login, then on to consent and a token", async () => {
    const clientId = await registerClient()
    const { verifier, challenge } = pkce()

    // 1. No session: the authorize request goes to the log-in page with the request logged into its query.
    const first = location(await get(authorizeUrl(clientId, challenge)))
    expect(first.pathname).toBe("/login")
    expect(first.searchParams.get("client_id")).toBe(clientId)
    expect(first.searchParams.get("sig")).toBeTruthy()

    // 2. The log-in page sends the user back into authorize with that same query, now with a session.
    const cookie = await signIn("ada@example.com")
    const second = location(
      await get(`/api/auth/oauth2/authorize?${first.searchParams}`, { cookie })
    )
    expect(second.pathname).toBe("/consent")
    expect(second.searchParams.get("client_id")).toBe(clientId)
    expect(second.searchParams.get("scope")).toContain(MCP_SCOPE)

    // 3. The consent page posts the answer with the signed query.
    const consent = await auth.handler(
      new Request(`${ISSUER}/oauth2/consent`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          accept: true,
          oauth_query: second.searchParams.toString(),
        }),
      })
    )
    expect(consent.status, await consent.clone().text()).toBe(200)
    const { url } = (await consent.json()) as { url: string }
    const callback = new URL(url)
    expect(callback.origin + callback.pathname).toBe(REDIRECT)
    expect(callback.searchParams.get("state")).toBe("s1")
    const code = callback.searchParams.get("code")!
    expect(code).toBeTruthy()

    // 4. The code becomes tokens.
    const token = await auth.handler(
      new Request(`${ISSUER}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
          client_id: clientId,
          code_verifier: verifier,
          resource: RESOURCE,
        }),
      })
    )
    expect(token.status, await token.clone().text()).toBe(200)
    const tokens = (await token.json()) as {
      access_token: string
      refresh_token?: string
      scope: string
      token_type: string
    }
    expect(tokens.token_type.toLowerCase()).toBe("bearer")
    expect(tokens.refresh_token).toBeTruthy()
    expect(tokens.scope.split(" ")).toContain(MCP_SCOPE)

    // 5. The MCP route's verifier accepts it and learns the user; a bad token is refused.
    let seen: Record<string, unknown> | null = null
    const protect = createMcpProtectedRequestHandler(
      { issuer: ISSUER, audience: RESOURCE, jwksUrl: `${ISSUER}/jwks`, requiredScopes: [MCP_SCOPE], jwtVerifyOptions: { requiredClaims: ["azp"] } },
      async (_req, claims) => {
        seen = claims as Record<string, unknown>
        return new Response("ok")
      }
    )
    const ok = await protect(
      new Request(RESOURCE, {
        method: "POST",
        headers: { authorization: `Bearer ${tokens.access_token}` },
      })
    )
    expect(ok.status).toBe(200)
    // The token is for the MCP server (and, with openid, the userinfo endpoint).
    expect(seen!.aud).toContain(RESOURCE)
    expect(seen).toMatchObject({ azp: clientId, iss: ISSUER })
    expect(typeof seen!.sub).toBe("string")

    const bad = await protect(
      new Request(RESOURCE, {
        method: "POST",
        headers: { authorization: "Bearer not-a-token" },
      })
    )
    expect(bad.status).toBe(401)
    expect(bad.headers.get("www-authenticate")).toContain("resource_metadata=")

    const none = await protect(new Request(RESOURCE, { method: "POST" }))
    expect(none.status).toBe(401)
    expect(none.headers.get("www-authenticate")).toMatch(/^Bearer /)

    // 6. The same user consents once: the next authorize goes straight to the callback.
    const again = location(
      await get(authorizeUrl(clientId, pkce().challenge, "s2"), { cookie })
    )
    expect(again.origin + again.pathname).toBe(REDIRECT)
    expect(again.searchParams.get("code")).toBeTruthy()
    accessToken = tokens.access_token
    refreshToken = tokens.refresh_token!
    testClientId = clientId
  })
})

/** The tokens the flow above produced, for the gate and Connected apps tests. */
let accessToken = ""
let refreshToken = ""
let testClientId = ""

const buttons = readFileSync(
  new URL("../../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

describe("the gate in front of /mcp", () => {
  const mcp = () => {
    const deps: Omit<McpDeps, "actor"> = {
      store: new PostgresLessonStore(db),
      limiter: new MemoryRateLimiter(),
      validateLimiter: new MemoryRateLimiter(120),
      origin: SITE,
      guide: skillBundle,
      drafts: new PostgresDraftStore(db),
      handleOf: (id) => handleOf(db, id),
    }
    return gateMcp({
      db,
      issuer: ISSUER,
      resource: RESOURCE,
      build: (actor) => createLearnMcp({ ...deps, actor }),
    })
  }
  let nextId = 1
  const rpc = (
    method: string,
    params: object,
    headers: Record<string, string> = {}
  ) =>
    mcp()(
      new Request(RESOURCE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "x-forwarded-for": "1.2.3.4",
          ...headers,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
      })
    )
  const call = (name: string, args: object, headers?: Record<string, string>) =>
    rpc("tools/call", { name, arguments: args }, headers)
  async function resultOf(res: Response) {
    expect(res.status, await res.clone().text()).toBe(200)
    const data = (await res.text())
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => JSON.parse(l.slice(6)))
      .find((m) => "result" in m || "error" in m)
    if (data.error) throw new Error(JSON.stringify(data.error))
    return data.result as {
      structuredContent: Record<string, unknown>
      isError?: boolean
    }
  }
  const bearer = () => ({ authorization: `Bearer ${accessToken}` })

  it("knows which calls need an account", () => {
    const call = (name: string) => ({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: {} },
    })
    expect(callsProtectedTool(call("keep_lesson"))).toBe(true)
    expect(callsProtectedTool(call("publish_lesson"))).toBe(false)
    expect(callsProtectedTool([call("get_guide"), call("keep_lesson")])).toBe(true)
    expect(callsProtectedTool({ jsonrpc: "2.0", id: 1, method: "tools/list" })).toBe(false)
    expect(callsProtectedTool(null)).toBe(false)
    expect(callsProtectedTool("keep_lesson")).toBe(false)
  })

  it("lets a logged-out app list tools and publish, and answers keep_lesson with the 401 that starts log-in", async () => {
    const tools = await resultOf(await rpc("tools/list", {}))
    expect(tools).toHaveProperty("tools")
    const published = await resultOf(await call("publish_lesson", { lesson: buttons }))
    expect(published.structuredContent).toMatchObject({ ok: true, owner: null })
    expect(published.structuredContent).toHaveProperty("editToken")

    const refused = await call("keep_lesson", {
      id: published.structuredContent.id,
      editToken: published.structuredContent.editToken,
    })
    expect(refused.status).toBe(401)
    const challenge = refused.headers.get("www-authenticate")!
    expect(challenge).toMatch(/^Bearer /)
    expect(challenge).toContain(
      `resource_metadata="${SITE}/.well-known/oauth-protected-resource/mcp"`
    )
    expect(challenge).toContain(`scope="${MCP_SCOPE}"`)
    // Nothing happened to the lesson.
    expect(
      (await new PostgresLessonStore(db).get(published.structuredContent.id as string))?.ownerId
    ).toBeNull()
  })

  it("refuses a bad token on any call, with the same challenge", async () => {
    const res = await rpc("tools/list", {}, { authorization: "Bearer nope" })
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=")
  })

  it("publishes to the account with a token, keeps with it, and never returns the edit token", async () => {
    expect(accessToken).toBeTruthy()
    const published = await resultOf(
      await call("publish_lesson", { lesson: buttons }, bearer())
    )
    const body = published.structuredContent
    expect(body).toMatchObject({
      ok: true,
      expiresAt: null,
      owner: { handle: expect.stringMatching(/^[a-z]+-[a-z]+$/) },
      visibility: "public",
    })
    expect(body).not.toHaveProperty("editToken")
    expect(body).not.toHaveProperty("claimUrl")
    const [ada] = await db.select().from(user).where(eq(user.email, "ada@example.com"))
    const store = new PostgresLessonStore(db)
    expect((await store.get(body.id as string))?.ownerId).toBe(ada!.id)

    // The logged-in app edits its lessons by account, no token in the chat.
    const updated = await resultOf(
      await call(
        "update_lesson",
        { id: body.id, patches: [{ op: "set", path: "title", value: "Kept" }] },
        bearer()
      )
    )
    expect(updated.isError).toBeFalsy()

    // A lesson published logged out, then kept once the app logged in: saved to the account and published in Explore.
    const anonymous = await resultOf(await call("publish_lesson", { lesson: buttons }))
    const kept = await resultOf(
      await call(
        "keep_lesson",
        {
          id: anonymous.structuredContent.id,
          editToken: anonymous.structuredContent.editToken,
        },
        bearer()
      )
    )
    expect(kept.structuredContent).toMatchObject({
      ok: true,
      id: anonymous.structuredContent.id,
      visibility: "public",
    })
    expect((await store.get(anonymous.structuredContent.id as string))?.ownerId).toBe(ada!.id)
  })

  it("treats a banned account's token as logged out", async () => {
    await db.update(user).set({ banned: true }).where(eq(user.email, "ada@example.com"))
    try {
      const res = await rpc("tools/list", {}, bearer())
      expect(res.status).toBe(401)
      expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"')
    } finally {
      await db.update(user).set({ banned: false }).where(eq(user.email, "ada@example.com"))
    }
  })
})

describe("Connected apps", () => {
  const userId = async () =>
    (await db.select({ id: user.id }).from(user).where(eq(user.email, "ada@example.com")))[0]!.id
  const refresh = () =>
    auth.handler(
      new Request(`${ISSUER}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: testClientId,
          resource: RESOURCE,
        }),
      })
    )

  it("lists the app that logged in, by its registered name, with when it was allowed and last used", async () => {
    expect(accessToken && refreshToken && testClientId).toBeTruthy()
    const apps = await connectedApps(db, await userId())
    expect(apps).toEqual([
      {
        id: expect.any(String),
        clientId: testClientId,
        name: "Test chat app",
        allowedAt: expect.any(String),
        lastUsedAt: expect.any(String),
      },
    ])
    // Refreshing the token counts as a use.
    const before = apps[0]!.lastUsedAt!
    await new Promise((r) => setTimeout(r, 1100))
    const refreshed = await refresh()
    expect(refreshed.status, await refreshed.clone().text()).toBe(200)
    refreshToken = ((await refreshed.json()) as { refresh_token: string }).refresh_token
    const [after] = await connectedApps(db, await userId())
    expect(Date.parse(after!.lastUsedAt!)).toBeGreaterThan(Date.parse(before))
    // Someone else sees nothing, and can't disconnect it.
    expect(await connectedApps(db, "nobody")).toEqual([])
    expect((await disconnectApp(db, "nobody", apps[0]!.id)).status).toBe(404)
    expect(await connectedApps(db, await userId())).toHaveLength(1)
  })

  it("disconnects the app: the list empties, its token is refused at /mcp, and it can't refresh", async () => {
    const id = await userId()
    const [app] = await connectedApps(db, id)
    const protect = gateMcp({
      db,
      issuer: ISSUER,
      resource: RESOURCE,
      build: () => async () => new Response("ok"),
    })
    const withToken = () =>
      protect(
        new Request(RESOURCE, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        })
      )
    expect((await withToken()).status).toBe(200)

    expect((await disconnectApp(db, id, app!.id)).status).toBe(200)
    expect(await connectedApps(db, id)).toEqual([])
    expect(await db.select().from(oauthConsent).where(eq(oauthConsent.userId, id))).toEqual([])

    const refused = await withToken()
    expect(refused.status).toBe(401)
    expect(refused.headers.get("www-authenticate")).toContain('error="invalid_token"')
    expect(refused.headers.get("www-authenticate")).toContain("resource_metadata=")
    const noRefresh = await refresh()
    expect(noRefresh.status).toBe(400)
    expect(((await noRefresh.json()) as { error: string }).error).toBe("invalid_grant")

    // Logging in again asks for consent again, rather than going straight back to the app.
    const cookie = await signIn("ada@example.com")
    const again = location(await get(authorizeUrl(testClientId, pkce().challenge, "s3"), { cookie }))
    expect(again.pathname).toBe("/consent")
  })
})
