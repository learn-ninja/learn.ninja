import { createHash, randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { account, connectPglite, user, type Db } from "@workspace/db"

import { MemoryRateLimiter } from "@/lib/publish/rate-limit"

import { getActor } from "./actor"
import {
  APP_ORIGIN,
  APPLE_APP_ONLY,
  APPLE_BUNDLE_ID,
  createAuth,
  type Auth,
} from "./auth"

// Sign in with Apple from the iOS app: the app posts the identity token iOS gave it, and Better
// Auth checks it against Apple's public keys. Here the keys Apple serves are a test key pair's,
// so tokens signed with it pass the real check (signature, issuer, audience, age, nonce), and
// tokens signed with any other key don't.

const ORIGIN = "http://localhost:3000"
const APPLE_KEYS = "https://appleid.apple.com/auth/keys"
const KID = "test-key"

let db: Db
let auth: Auth
let applePrivate: CryptoKey
let otherPrivate: CryptoKey
const codes = new Map<string, string>()
const realFetch = globalThis.fetch

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true })
  applePrivate = pair.privateKey
  otherPrivate = (await generateKeyPair("RS256")).privateKey
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: KID,
    alg: "RS256",
    use: "sig",
  }
  // Apple's key set, from the test key; every other request goes out as usual.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (url === APPLE_KEYS) return Response.json({ keys: [jwk] })
    return realFetch(input, init)
  })
  db = await connectPglite()
  auth = createAuth({
    db,
    env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    sendCode: async (email, code) => void codes.set(email, code),
    codeLimiter: new MemoryRateLimiter(100),
  })
}, 30_000)

afterAll(() => {
  vi.restoreAllMocks()
})

/** What the app hashes into its request to Apple: the identity token carries this, not the nonce. */
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")

interface TokenOptions {
  sub?: string
  email?: string
  privateEmail?: boolean
  nonce?: string
  audience?: string
  issuer?: string
  key?: CryptoKey
}

/** An identity token as Apple signs it for the app. */
async function identityToken(options: TokenOptions = {}) {
  const email = options.email ?? `${randomUUID()}@example.com`
  return new SignJWT({
    email,
    email_verified: "true",
    is_private_email: options.privateEmail ? "true" : "false",
    nonce: sha256(options.nonce ?? "nonce"),
    nonce_supported: true,
    real_user_status: 2,
  })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(options.issuer ?? "https://appleid.apple.com")
    .setAudience(options.audience ?? APPLE_BUNDLE_ID)
    .setSubject(
      options.sub ?? `000123.${randomUUID().replaceAll("-", "")}.0456`
    )
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(options.key ?? applePrivate)
}

/** The app's request: @better-auth/expo's client sends its scheme as expo-origin. */
function signInWithApple(body: unknown) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "expo-origin": APP_ORIGIN,
      },
      body: JSON.stringify(body),
    })
  )
}

/** A one-time nonce from the server, as the app asks for one before opening Apple's sheet. */
async function serverNonce(): Promise<string> {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth/app/apple/nonce`, {
      method: "POST",
      headers: { "expo-origin": APP_ORIGIN },
    })
  )
  expect(res.status).toBe(200)
  const { nonce } = (await res.json()) as { nonce: string }
  expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)
  return nonce
}

async function appleSignIn(options: TokenOptions & { name?: string } = {}) {
  const nonce = options.nonce ?? (await serverNonce())
  const token = await identityToken({ ...options, nonce })
  const res = await signInWithApple({
    provider: "apple",
    idToken: {
      token,
      nonce,
      ...(options.name
        ? { user: { name: { firstName: options.name, lastName: "Lovelace" } } }
        : {}),
    },
  })
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  return { res, cookie }
}

const appleAccounts = (userId: string) =>
  db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "apple")))

describe("Sign in with Apple", () => {
  it("creates an account from the app's identity token, with a random handle and Apple's name", async () => {
    const email = "new-apple@example.com"
    const { res, cookie } = await appleSignIn({ email, name: "Ada" })
    expect(res.status).toBe(200)
    const actor = await getActor(auth, new Headers({ cookie }))
    expect(actor).toMatchObject({
      email,
      handle: expect.stringMatching(/^[a-z]+-[a-z]+$/),
      viaApiKey: false,
    })
    const [row] = await db.select().from(user).where(eq(user.email, email))
    expect(row).toMatchObject({ name: "Ada Lovelace", emailVerified: true })
    expect(await appleAccounts(row!.id)).toHaveLength(1)
  })

  it("joins the account that already has the email, rather than making a second one", async () => {
    const email = "code-first@example.com"
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
    await auth.api.signInEmailOTP({ body: { email, otp: codes.get(email)! } })
    const [before] = await db.select().from(user).where(eq(user.email, email))

    const { res, cookie } = await appleSignIn({ email })
    expect(res.status).toBe(200)
    expect(await getActor(auth, new Headers({ cookie }))).toMatchObject({
      userId: before!.id,
    })
    expect(
      await db.select().from(user).where(eq(user.email, email))
    ).toHaveLength(1)
    expect(await appleAccounts(before!.id)).toHaveLength(1)
  })

  it("makes an account for Apple's private relay address, and finds it again by Apple's user ID", async () => {
    const sub = "001234.privaterelayuser.0001"
    const email = "x7k2m9q4p1@privaterelay.appleid.com"
    const first = await appleSignIn({ sub, email, privateEmail: true })
    expect(first.res.status).toBe(200)
    const [row] = await db.select().from(user).where(eq(user.email, email))
    expect(row).toBeDefined()

    // A later token may carry another address (the person stopped hiding it): same Apple user,
    // same account.
    const again = await appleSignIn({ sub, email: "shown@example.com" })
    expect(again.res.status).toBe(200)
    expect(
      await getActor(auth, new Headers({ cookie: again.cookie }))
    ).toMatchObject({ userId: row!.id })
  })

  it("refuses a token signed with another key, for another app, from another issuer, or with another nonce", async () => {
    const refused = async (options: TokenOptions, other = false) => {
      const nonce = await serverNonce()
      const token = await identityToken({ nonce, ...options })
      const sentNonce = other ? await serverNonce() : nonce
      const res = await signInWithApple({
        provider: "apple",
        idToken: { token, nonce: sentNonce },
      })
      expect(res.status).toBe(401)
      expect(res.headers.getSetCookie()).toEqual([])
    }
    await refused({ key: otherPrivate })
    await refused({ audience: "com.example.other" })
    await refused({ issuer: "https://evil.example" })
    await refused({}, true)
  })

  it("takes each token once, and only with a nonce this server made", async () => {
    const send = (token: string, nonce?: unknown) =>
      signInWithApple({
        provider: "apple",
        idToken: nonce === undefined ? { token } : { token, nonce },
      })
    const nonce = await serverNonce()
    const token = await identityToken({ nonce })
    expect((await send(token, nonce)).status).toBe(200)
    // Replayed with the same nonce: spent.
    expect((await send(token, nonce)).status).toBe(401)

    const fresh = await serverNonce()
    const other = await identityToken({ nonce: fresh })
    // Without a nonce, or with the hash read back out of the token.
    expect((await send(other)).status).toBe(401)
    expect((await send(other, sha256(fresh))).status).toBe(401)
    // A nonce the server never made, shaped like one.
    const made = "A".repeat(43)
    expect(
      (await send(await identityToken({ nonce: made }), made)).status
    ).toBe(401)
  })

  it("refuses Apple's browser flow, which only the app's identity token replaces", async () => {
    for (const path of ["/sign-in/social", "/link-social"]) {
      const res = await auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider: "apple", callbackURL: "/" }),
        })
      )
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({
        code: "APPLE_APP_ONLY",
        message: APPLE_APP_ONLY,
      })
    }
  })
})
