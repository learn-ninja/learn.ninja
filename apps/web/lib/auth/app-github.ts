import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import type { BetterAuthPlugin } from "better-auth"
import {
  addOAuthServerContext,
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api"
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies"
import {
  generateIdTokenNonce,
  generateState,
  getOAuthCallbackPath,
} from "better-auth/oauth2"
import * as z from "zod"

// Logging in to the iOS app with GitHub. The app can't use Better Auth's expo plugin for this: its
// /expo-authorization-proxy redirects to any https URL and plants any OAuth state cookie it's
// handed, which let anyone finish a GitHub log-in started on another device (so it stays disabled
// in auth.ts). Instead, PKCE between the app and this server:
//
// 1. The app makes a random verifier, and opens the system's sign-in sheet
//    (ASWebAuthenticationSession) at GET /api/auth/app/github/start?challenge={sha256(verifier)}.
//    That starts a fresh GitHub log-in in the sheet's own browser, with the challenge in the
//    OAuth state's server context (never from a request body, so it can't be swapped later).
// 2. GitHub comes back to Better Auth's usual /callback/github, which logs the browser in. The
//    after hook below sees the challenge, logs the browser out again (the session was only a way
//    to learn who this is), and redirects to APP_CALLBACK_PATH with a one-time code for that user,
//    bound to the challenge.
// 3. The sheet only hands that URL to the app: https://learn.ninja/app/signed-in is the app's
//    by the site's webcredentials association, which no other app can claim the way any app can
//    claim a URL scheme. The app posts the code with its verifier to /app/github/redeem and gets
//    its own session cookie back.
//
// A link someone else crafted (their challenge, sent to you) runs steps 1 and 2 in your browser for
// your account, but the code lands on a learn.ninja page in your browser, and redeeming it needs
// their verifier and your code together: they have only the first.

/** Where the sheet ends: the app's callback, and the page Safari shows if it ever loads it. */
export const APP_CALLBACK_PATH = "/app/signed-in"
/** The URL scheme for development builds, whose server is http://localhost (no universal link). */
const DEV_CALLBACK = "learnninja://app/signed-in"
/** How long the app has to redeem a code, in seconds: it does so at once. */
export const APP_CODE_SECONDS = 2 * 60

/** A PKCE S256 challenge: base64url of a SHA-256, 43 characters. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/
/** A PKCE verifier (RFC 7636): 43 to 128 unreserved characters. */
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/

const identifier = (code: string) => `app-github:${code}`

export function challengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

/**
 * Where the code goes: the site's own https page (only production's host is the app's), or the
 * app's scheme for a development server on plain http. Never the scheme in production, whatever
 * protocol a request came in on: any app can claim a scheme, and one that started the log-in
 * holds the verifier, so a code sent there would be a session for whoever's browser finished it.
 */
export function appCallbackURL(baseURL: string, production: boolean): string {
  const url = new URL(baseURL)
  if (!production && url.protocol === "http:") return DEV_CALLBACK
  return `https://${url.host}${APP_CALLBACK_PATH}`
}

/**
 * Burns a code the fallback page was shown (app/app/signed-in). The app's sheet takes the URL
 * before it loads, so a page that loads with a code means the log-in didn't start in this app,
 * maybe from someone else's link with their challenge: the code shouldn't sit there for anyone to
 * be talked into sharing.
 */
export async function burnAppCode(
  auth: {
    $context: Promise<{
      internalAdapter: {
        consumeVerificationValue: (identifier: string) => Promise<unknown>
      }
    }>
  },
  code: string
): Promise<void> {
  if (!code || code.length > 64) return
  const ctx = await auth.$context
  await ctx.internalAdapter.consumeVerificationValue(identifier(code))
}

function sameChallenge(verifier: string, challenge: string): boolean {
  const a = Buffer.from(challengeOf(verifier))
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function appGitHub({ production }: { production: boolean }) {
  return {
    id: "app-github",
    endpoints: {
      appGitHubStart: createAuthEndpoint(
        "/app/github/start",
        {
          method: "GET",
          query: z.object({ challenge: z.string().regex(CHALLENGE) }),
        },
        async (ctx) => {
          const provider = ctx.context.socialProviders.find(
            (p) => p.id === "github"
          )
          if (!provider) throw new APIError("NOT_FOUND")
          const done = appCallbackURL(ctx.context.baseURL, production)
          // Server-only data that comes back with the state on the callback.
          await addOAuthServerContext({ appChallenge: ctx.query.challenge })
          // generateState reads the callback URLs from a body, as /sign-in/social has one. Both
          // are ours (fixed above), so nothing from the request reaches them. A failure on the
          // callback comes to the same place with ?error=.
          const request = Object.create(ctx) as typeof ctx & {
            body: { callbackURL: string; errorCallbackURL: string }
          }
          request.body = { callbackURL: done, errorCallbackURL: done }
          const idTokenNonce = generateIdTokenNonce(provider)
          const { state, codeVerifier } = await generateState(request, {
            idTokenNonce,
          })
          const url = await provider.createAuthorizationURL({
            state,
            codeVerifier,
            idTokenNonce,
            redirectURI: `${ctx.context.baseURL}${getOAuthCallbackPath(provider)}`,
          })
          throw ctx.redirect(url.toString())
        }
      ),
      appGitHubRedeem: createAuthEndpoint(
        "/app/github/redeem",
        {
          method: "POST",
          body: z.object({
            code: z.string().min(1).max(64),
            verifier: z.string().regex(VERIFIER),
          }),
        },
        async (ctx) => {
          // Single use: consumed (and gone) whatever happens next.
          const row =
            await ctx.context.internalAdapter.consumeVerificationValue(
              identifier(ctx.body.code)
            )
          const value = row
            ? (JSON.parse(row.value) as {
                userId?: unknown
                challenge?: unknown
              })
            : null
          if (
            !value ||
            typeof value.userId !== "string" ||
            typeof value.challenge !== "string" ||
            !sameChallenge(ctx.body.verifier, value.challenge)
          ) {
            throw new APIError("UNAUTHORIZED", {
              code: "INVALID_CODE",
              message: "That log-in didn't work. Try again.",
            })
          }
          const user = await ctx.context.internalAdapter.findUserById(
            value.userId
          )
          if (!user)
            throw new APIError("UNAUTHORIZED", { code: "INVALID_CODE" })
          // The session hooks run here too (a banned account is refused).
          const session = await ctx.context.internalAdapter.createSession(
            user.id
          )
          await setSessionCookie(ctx, { session, user })
          return ctx.json({ user: { id: user.id } })
        }
      ),
    },
    hooks: {
      after: [
        {
          matcher: (ctx) => Boolean(ctx.path?.startsWith("/callback/")),
          handler: createAuthMiddleware(async (ctx) => {
            const challenge = (await getOAuthState())?.serverContext
              ?.appChallenge
            if (typeof challenge !== "string" || !CHALLENGE.test(challenge))
              return
            const created = ctx.context.newSession
            // No session: the callback failed, and already sends the error to the app.
            if (!created) return
            // The browser was only a way to learn who this is: its new session goes. A browser that
            // was logged in before (the sheet shares Safari's cookies) gets its own session back,
            // so neither the app's log-in nor someone else's link to /start logs Safari out.
            await ctx.context.internalAdapter.deleteSession(
              created.session.token
            )
            const before = await ctx.getSignedCookie(
              ctx.context.authCookies.sessionToken.name,
              ctx.context.secret
            )
            const prior =
              before && before !== created.session.token
                ? await ctx.context.internalAdapter.findSession(before)
                : null
            if (prior && new Date(prior.session.expiresAt) > new Date())
              await setSessionCookie(ctx, prior)
            else deleteSessionCookie(ctx)
            const code = randomBytes(32).toString("base64url")
            await ctx.context.internalAdapter.createVerificationValue({
              identifier: identifier(code),
              value: JSON.stringify({ userId: created.user.id, challenge }),
              expiresAt: new Date(Date.now() + APP_CODE_SECONDS * 1000),
            })
            const to = new URL(appCallbackURL(ctx.context.baseURL, production))
            to.searchParams.set("code", code)
            ctx.setHeader("location", to.toString())
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin
}
