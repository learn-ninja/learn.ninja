import { apiKey } from "@better-auth/api-key"
import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
import { emailOTP } from "better-auth/plugins/email-otp"
import { jwt } from "better-auth/plugins/jwt"
import { eq } from "drizzle-orm"
import { after } from "next/server"

import type { SecondaryStorage } from "@better-auth/core/db"
import { schema, user, type Db } from "@workspace/db"

import { SITE } from "@/lib/site"
import { getRateLimiter, type RateLimiter } from "@/lib/publish/rate-limit"
import { getDb } from "@/lib/publish/store"

import { codeSenderFromEnv, type CodeSender } from "./email"
import {
  findByHandle,
  freeHandle,
  handleProblem,
  normalizeHandle,
  randomHandle,
} from "./handles"
import { authStorageFromEnv } from "./storage"

// Better Auth, as plans/accounts-v2.md describes: GitHub (website only) and a six-digit email code
// (website and terminal), API keys for the terminal, sessions cached in a cookie and kept in Redis.
// Users live in our Postgres through the Drizzle adapter (packages/db has the tables). It is also
// the OAuth 2.1 server chat apps log in through (`mcp`, below): the MCP server at /mcp answers a
// `keep_lesson` call from a logged-out app with a 401, the app sends the user to /login and
// /consent here, and comes back with a token that names the account on every later call.

/** How long a log-in code works, in seconds, and how many guesses it allows. */
export const CODE_EXPIRY_SECONDS = 5 * 60
export const CODE_ATTEMPTS = 3
/** API keys start with this, so a leaked one is easy to recognize. */
export const API_KEY_PREFIX = "learn_"
/**
 * The key inside a personal MCP URL (https://learn.ninja/mcp/{key}) starts with this. Such a key
 * works only there: sent as x-api-key, to the account API or to Better Auth's own routes, it's
 * refused (the hook below and getActor), so a URL that leaks from a screenshot or a config can
 * publish and edit lessons, and nothing else.
 */
export const MCP_KEY_PREFIX = "learn_mcp_"
/** What an MCP key may do; /mcp/{key} checks it, so a terminal key pasted into the URL is refused too. */
export const MCP_KEY_PERMISSIONS = { mcp: ["publish"] }

/** Why an MCP key sent as x-api-key is refused. */
export const MCP_KEY_AS_HEADER =
  "This key belongs in a chat app's MCP URL and works nowhere else. For the terminal, run `learn login`."

/**
 * Routes that change how the account logs in (the email change, and linking or unlinking GitHub),
 * with what a session that's too old is told. Only a recent browser session may call them, never
 * an API key, so neither a leaked key nor an old stolen cookie can take the account.
 */
export const LOG_IN_ROUTES: Record<string, string> = {
  "/email-otp/request-email-change": "Log in again to change your email.",
  "/email-otp/change-email": "Log in again to change your email.",
  "/link-social": "Log in again to connect GitHub.",
  "/unlink-account": "Log in again to disconnect GitHub.",
}

/** A session older than this logs in again before changing how it logs in (also Better Auth's freshAge). */
export const FRESH_SESSION_SECONDS = 24 * 60 * 60

/** The one OAuth scope the MCP server asks for: publishing and keeping lessons as the user. */
export const MCP_SCOPE = "lessons"
/** Every scope the OAuth server issues; `offline_access` is what makes a chat app stay logged in. */
export const OAUTH_SCOPES = ["openid", "offline_access", MCP_SCOPE] as const
/** How long a chat app stays logged in without being used, in seconds (refresh tokens rotate on use). */
const REFRESH_TOKEN_SECONDS = 90 * 24 * 60 * 60

/**
 * The site's public origin, as chat apps reach it: LEARN_PUBLIC_URL, else the production domain, a
 * preview deployment's branch alias (the URL people paste, not the one-off deployment host), or
 * the dev server on whatever port it got.
 */
export function publicSiteFromEnv(env = process.env): string {
  if (env.LEARN_PUBLIC_URL) return env.LEARN_PUBLIC_URL
  if (env.VERCEL_ENV === "production") return "https://learn.ninja"
  const preview = env.VERCEL_BRANCH_URL ?? env.VERCEL_URL
  if (preview) return `https://${preview}`
  return `http://localhost:${env.PORT ?? 3000}`
}

/**
 * The MCP server's canonical URL, which tokens are bound to and the discovery document names. It
 * must be exactly what people paste into their chat app (the plugin takes http only on loopback
 * hosts, so development works too).
 */
export function mcpResourceFromEnv(env = process.env): string {
  return `${publicSiteFromEnv(env)}/mcp`
}

/** The OAuth issuer: Better Auth's base URL, which is where chat apps log in and get tokens. */
export function oauthIssuerFromEnv(env = process.env): string {
  return env.BETTER_AUTH_URL ?? `${publicSiteFromEnv(env)}/api/auth`
}

/**
 * A fixed log-in for Anthropic's directory reviewers, who need a test account but can't read our
 * email: REVIEW_SIGN_IN_EMAIL always gets REVIEW_SIGN_IN_CODE, and no email is sent to it. Unset in
 * development and tests unless passed in.
 */
export interface ReviewLogin {
  email: string
  code: string
}

export function reviewLoginFromEnv(env = process.env): ReviewLogin | null {
  const email = env.REVIEW_SIGN_IN_EMAIL?.trim().toLowerCase()
  const code = env.REVIEW_SIGN_IN_CODE?.trim()
  if (!email || !code || !/^\d{6}$/.test(code)) return null
  return { email, code }
}

export interface AuthDeps {
  db: Db
  env?: NodeJS.ProcessEnv
  /** Delivers a log-in code; the console in development. */
  sendCode?: CodeSender
  /** Redis for sessions and Better Auth's rate limits; null keeps sessions in Postgres. */
  storage?: SecondaryStorage | null
  /** Codes sent per email address, on top of Better Auth's per-IP limit. */
  codeLimiter?: RateLimiter
  /** The MCP server's URL that OAuth tokens are bound to; `mcpResourceFromEnv` otherwise. */
  resource?: string
  /** The reviewers' fixed log-in; `reviewLoginFromEnv` otherwise. */
  reviewLogin?: ReviewLogin | null
}

/** The GitHub OAuth app, when its keys are set. The log-in page hides GitHub otherwise. */
export function githubFromEnv(env = process.env) {
  const clientId = env.GITHUB_CLIENT_ID
  const clientSecret = env.GITHUB_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/**
 * The signing secret: BETTER_AUTH_SECRET on every Vercel environment, Better Auth's default in
 * development. It also encrypts the private key that signs OAuth tokens, which lives in the jwks
 * table of the one database previews and production share, so every deployment must use the same
 * value: a key minted under one secret can't sign under another (previews once derived a secret
 * from DATABASE_URL, and the key one of them minted left production unable to issue tokens). A
 * deployment without the variable throws at start-up rather than minting an incompatible key.
 */
function secretFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET
  if (env.VERCEL_ENV) throw new Error("BETTER_AUTH_SECRET is not set for this Vercel environment.")
  return undefined
}

export function createAuth(deps: AuthDeps) {
  const env = deps.env ?? process.env
  const github = githubFromEnv(env)
  const sendCode = deps.sendCode ?? codeSenderFromEnv(env)
  const storage = deps.storage ?? undefined
  const codeLimiter = deps.codeLimiter ?? getRateLimiter("code")
  const resource = deps.resource ?? mcpResourceFromEnv(env)
  const review =
    deps.reviewLogin === undefined ? reviewLoginFromEnv(env) : deps.reviewLogin
  const isReviewer = (email: string) =>
    review !== null && email.trim().toLowerCase() === review.email

  return betterAuth({
    appName: SITE.name,
    secret: secretFromEnv(env),
    // The site or a preview deployment: whichever host the request came to. In development any
    // local port works, and a tunnel (for trying a chat app against this machine) does too. The
    // OAuth provider needs one of these forms at start-up: a URL, or hosts with a fallback.
    baseURL: env.BETTER_AUTH_URL ?? {
      allowedHosts:
        env.NODE_ENV === "production"
          ? ["learn.ninja", "www.learn.ninja", "*.vercel.app"]
          : [
              "localhost:*",
              "127.0.0.1:*",
              "learn.test",
              "*.trycloudflare.com",
              "*.ngrok-free.app",
            ],
      fallback: publicSiteFromEnv(env),
    },
    database: drizzleAdapter(deps.db, { provider: "pg", schema }),
    secondaryStorage: storage,
    // The jwt plugin's /token hands out a session JWT; chat apps get theirs from /oauth2/token.
    disabledPaths: ["/token"],
    session: {
      freshAge: FRESH_SESSION_SECONDS,
      // A signed cookie answers most session checks without a database or Redis read.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
      // With Redis holding sessions, the OAuth provider still needs them in Postgres: its refresh
      // tokens point at the session row, and it refuses to start otherwise.
      storeSessionInDatabase: Boolean(storage),
    },
    account: {
      accountLinking: {
        // Linking GitHub from the settings page: the user is logged in and proves they own the
        // GitHub account, so its email may differ. Logging in with GitHub still only joins an
        // account whose email matches.
        allowDifferentEmails: true,
        // Every account can log in with a code to its email, which isn't an account row, so
        // unlinking GitHub never locks anyone out.
        allowUnlinkingAll: true,
      },
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
        // A code to the new address only: the user is already logged in (recently; see the hook).
        changeEmail: { enabled: true, verifyCurrentEmail: false },
        // Reviewers get their fixed code and no email; everyone else a random one.
        generateOTP: ({ email, type }) =>
          type === "sign-in" && isReviewer(email) ? review!.code : undefined,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in" && !isReviewer(email)) await sendCode(email, otp)
          if (type === "change-email") await sendCode(email, otp, "change-email")
        },
      }),
      // Signs the OAuth access tokens (and serves their public keys at /jwks).
      jwt({ disableSettingJwtHeader: true }),
      // The OAuth 2.1 server for chat apps. Clients identify themselves with a Client ID Metadata
      // Document (`cimd`, what Claude and ChatGPT do) or, for older apps, register dynamically.
      mcp({
        resource,
        loginPage: "/login",
        consentPage: "/consent",
        scopes: [...OAUTH_SCOPES],
        refreshTokenExpiresIn: REFRESH_TOKEN_SECONDS,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Clients that don't say what they are (Cursor, older Claude Code) are native apps, so
        // their localhost and custom-scheme callbacks work.
        clientRegistrationDefaultApplicationType: "infer",
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: "mcp-2026-07-28",
      }),
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        // The publish routes read x-api-key as a session.
        enableSessionForAPIKeys: true,
        // Publishing has its own limits; a key shouldn't stop after ten lessons a day.
        rateLimit: { enabled: false },
        // Enough of the start to tell keys apart in the settings, and to see an MCP key's prefix.
        startingCharactersConfig: { charactersLength: MCP_KEY_PREFIX.length + 4 },
      }),
    ],
    hooks: {
      // Each code is an email we pay for: a per-address limit, checked before the code is made.
      // (Better Auth sends codes after replying, so sendVerificationOTP can't refuse.)
      before: createAuthMiddleware(async (ctx) => {
        const apiKeyHeader = ctx.headers?.get("x-api-key")
        // An MCP key is a bearer for one URL, not an account key: never a session here, whatever
        // the route (get-session, update-user, api-key/delete…). /mcp/{key} verifies it by value.
        if (apiKeyHeader?.startsWith(MCP_KEY_PREFIX)) {
          throw new APIError("FORBIDDEN", { message: MCP_KEY_AS_HEADER })
        }
        // A key may not mint keys: only a browser session can (POST /api/keys does the same).
        if (ctx.path === "/api-key/create" && apiKeyHeader) {
          throw new APIError("FORBIDDEN", {
            message: "Make new keys from the website, logged in.",
          })
        }
        const logInAgain = Object.hasOwn(LOG_IN_ROUTES, ctx.path)
          ? LOG_IN_ROUTES[ctx.path]
          : undefined
        if (logInAgain) {
          if (apiKeyHeader) {
            throw new APIError("FORBIDDEN", {
              message: "Change how you log in from the website, logged in.",
            })
          }
          // Checked before anything else, so a request without a session spends no code allowance.
          const session = await getSessionFromCtx(ctx)
          if (!session) throw new APIError("UNAUTHORIZED")
          const age = Date.now() - new Date(session.session.createdAt).getTime()
          if (age >= FRESH_SESSION_SECONDS * 1000) {
            throw new APIError("FORBIDDEN", {
              code: "SESSION_NOT_FRESH",
              message: logInAgain,
            })
          }
        }
        if (ctx.path === "/email-otp/request-email-change") {
          const newEmail = (ctx.body as { newEmail?: unknown } | undefined)
            ?.newEmail
          if (
            typeof newEmail === "string" &&
            !(await codeLimiter.allow(newEmail.trim().toLowerCase()))
          ) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Too many codes sent to this address. Try again later.",
            })
          }
          return
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
        "/email-otp/request-email-change": { window: 60, max: 3 },
        "/email-otp/change-email": { window: 60, max: 6 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // GitHub users arrive with their login as the handle; everyone else gets a random one.
          before: async (data) =>
            data.handle
              ? undefined
              : { data: { ...data, handle: await randomHandle(deps.db) } },
        },
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
          // A banned user keeps the account but can't log in.
          before: async (session) => {
            const [row] = await deps.db
              .select({ banned: user.banned })
              .from(user)
              .where(eq(user.id, session.userId))
            if (row?.banned) {
              throw new APIError("FORBIDDEN", {
                message: "This account can't log in.",
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
