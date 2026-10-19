import { createHash } from "node:crypto"

import { apiKey } from "@better-auth/api-key"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { emailOTP } from "better-auth/plugins/email-otp"
import { eq } from "drizzle-orm"
import { after } from "next/server"

import type { SecondaryStorage } from "@better-auth/core/db"
import { schema, user, type Db } from "@workspace/db"

import { SITE } from "@/lib/site"
import { getRateLimiter, type RateLimiter } from "@/lib/publish/rate-limit"
import { getDb } from "@/lib/publish/store"

import { codeSenderFromEnv, type CodeSender } from "./email"
import { findByHandle, freeHandle, handleProblem, normalizeHandle } from "./handles"
import { authStorageFromEnv } from "./storage"

// Better Auth, as plans/accounts-v2.md describes: GitHub (website only) and a six-digit email code
// (website and terminal), API keys for the terminal, sessions cached in a cookie and kept in Redis.
// Users live in our Postgres through the Drizzle adapter (packages/db has the tables).

/** How long a sign-in code works, in seconds, and how many guesses it allows. */
export const CODE_EXPIRY_SECONDS = 5 * 60
export const CODE_ATTEMPTS = 3
/** API keys start with this, so a leaked one is easy to recognize. */
export const API_KEY_PREFIX = "learn_"

export interface AuthDeps {
  db: Db
  env?: NodeJS.ProcessEnv
  /** Delivers a sign-in code; the console in development. */
  sendCode?: CodeSender
  /** Redis for sessions and Better Auth's rate limits; null keeps sessions in Postgres. */
  storage?: SecondaryStorage | null
  /** Codes sent per email address, on top of Better Auth's per-IP limit. */
  codeLimiter?: RateLimiter
}

/** The GitHub OAuth app, when its keys are set. The sign-in page hides GitHub otherwise. */
export function githubFromEnv(env = process.env) {
  const clientId = env.GITHUB_CLIENT_ID
  const clientSecret = env.GITHUB_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/**
 * The signing secret. Production needs BETTER_AUTH_SECRET. A preview deployment without one derives
 * a secret from its own database URL, which is unique per Neon branch and never leaves Vercel, so
 * previews work before anyone sets the variable. Development uses Better Auth's default.
 */
function secretFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production" && env.DATABASE_URL)
    return createHash("sha256").update(env.DATABASE_URL).digest("base64url")
  return undefined
}

export function createAuth(deps: AuthDeps) {
  const env = deps.env ?? process.env
  const github = githubFromEnv(env)
  const sendCode = deps.sendCode ?? codeSenderFromEnv(env)
  const storage = deps.storage ?? undefined
  const codeLimiter = deps.codeLimiter ?? getRateLimiter("code")

  return betterAuth({
    appName: SITE.name,
    secret: secretFromEnv(env),
    // The site or a preview deployment: whichever host the request came to. In development the
    // origin comes from the request itself, so any local port works.
    baseURL:
      env.BETTER_AUTH_URL ??
      (env.NODE_ENV === "production"
        ? {
            allowedHosts: ["learn.ninja", "www.learn.ninja", "*.vercel.app"],
            fallback: env.LEARN_PUBLIC_URL ?? "https://learn.ninja",
          }
        : undefined),
    database: drizzleAdapter(deps.db, { provider: "pg", schema }),
    secondaryStorage: storage,
    session: {
      // A signed cookie answers most session checks without a database or Redis read.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        // Set through updateUser, so the cookie cache refreshes; the hook below checks it.
        handle: { type: "string", required: false, unique: true, input: true },
        bio: { type: "string", required: false, input: false },
        banned: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    socialProviders: github
      ? {
          github: {
            ...github,
            mapProfileToUser: async (profile) => ({
              handle: await freeHandle(deps.db, profile.login),
            }),
          },
        }
      : {},
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_EXPIRY_SECONDS,
        allowedAttempts: CODE_ATTEMPTS,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") await sendCode(email, otp)
        },
      }),
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        // The publish routes read x-api-key as a session.
        enableSessionForAPIKeys: true,
        // Publishing has its own limits; a key shouldn't stop after ten lessons a day.
        rateLimit: { enabled: false },
        startingCharactersConfig: { charactersLength: API_KEY_PREFIX.length + 4 },
      }),
    ],
    hooks: {
      // Each code is an email we pay for: a per-address limit, checked before the code is made.
      // (Better Auth sends codes after replying, so sendVerificationOTP can't refuse.)
      before: createAuthMiddleware(async (ctx) => {
        // A key may not mint keys: only a browser session can (POST /api/keys does the same).
        if (ctx.path === "/api-key/create" && ctx.headers?.get("x-api-key")) {
          throw new APIError("FORBIDDEN", {
            message: "Make new keys from the website, signed in.",
          })
        }
        if (ctx.path !== "/email-otp/send-verification-otp") return
        const email = (ctx.body as { email?: unknown } | undefined)?.email
        if (typeof email !== "string" || !email) return
        if (!(await codeLimiter.allow(email.trim().toLowerCase()))) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many codes sent to this address. Try again later.",
          })
        }
      }),
    },
    rateLimit: {
      enabled: env.NODE_ENV === "production",
      storage: storage ? "secondary-storage" : "memory",
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 6 },
      },
    },
    databaseHooks: {
      user: {
        update: {
          // Every handle change, from the settings page or anywhere else, follows the rules.
          before: async (data, ctx) => {
            if (!("handle" in data)) return
            const handle = normalizeHandle(String(data.handle ?? ""))
            const problem = handleProblem(handle)
            if (problem) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message: problem,
                code: "INVALID_HANDLE",
              })
            }
            const taken = await findByHandle(deps.db, handle)
            if (taken && taken.id !== ctx?.context.session?.user.id) {
              throw new APIError("CONFLICT", {
                message: "Someone already has that handle.",
                code: "HANDLE_TAKEN",
              })
            }
            return { data: { ...data, handle } }
          },
        },
      },
      session: {
        create: {
          // A banned user keeps the account but can't sign in.
          before: async (session) => {
            const [row] = await deps.db
              .select({ banned: user.banned })
              .from(user)
              .where(eq(user.id, session.userId))
            if (row?.banned) {
              throw new APIError("FORBIDDEN", {
                message: "This account can't sign in.",
              })
            }
          },
        },
      },
    },
    advanced: {
      // Vercel sets x-forwarded-for; Better Auth's rate limits key on it.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
      // Better Auth sends the code after replying, as a background task. On Vercel the function is
      // frozen the moment the response is out, so the task must be handed to Next's after(), which
      // keeps the function alive until it settles. Outside a request (tests) it just runs.
      backgroundTasks: {
        handler: (task) => {
          try {
            after(task)
          } catch {
            void task
          }
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

// Kept on globalThis like the lesson store, so hot reloads reuse one instance.
const shared = globalThis as { learnAuth?: Promise<Auth> }

export function getAuth(): Promise<Auth> {
  if (!shared.learnAuth) {
    const pending = getDb().then((db) =>
      createAuth({ db, storage: authStorageFromEnv() })
    )
    pending.catch(() => {
      if (shared.learnAuth === pending) shared.learnAuth = undefined
    })
    shared.learnAuth = pending
  }
  return shared.learnAuth
}
