import { randomBytes } from "node:crypto"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
} from "better-auth/api"

// One-time nonces for Sign in with Apple in the iOS app. Better Auth checks an Apple identity
// token's signature, issuer, audience and age, and its nonce only when one is sent, against
// whatever nonce the request names: a token captured once could log in again and again for its
// hour. So the server hands out the nonce, and spends it:
//
// 1. The app asks POST /api/auth/app/apple/nonce for a fresh one (kept here 10 minutes).
// 2. It passes the nonce's SHA-256 to Apple, which signs it into the identity token.
// 3. It posts the token and the nonce to /sign-in/social. The hook below consumes the nonce
//    before Better Auth checks the token against it, so each token works once, and only with the
//    nonce this server made (not, say, the hash read back out of the token).

const NONCE_SECONDS = 10 * 60
/** 32 random bytes as base64url. */
const NONCE = /^[A-Za-z0-9_-]{43}$/
const identifier = (nonce: string) => `app-apple-nonce:${nonce}`

/** The routes an Apple identity token can be posted to. */
const ID_TOKEN_ROUTES = new Set(["/sign-in/social", "/link-social"])

const refused = () =>
  new APIError("UNAUTHORIZED", {
    code: "INVALID_NONCE",
    message: "That Apple sign-in expired. Try again.",
  })

export function appApple() {
  return {
    id: "app-apple",
    endpoints: {
      appAppleNonce: createAuthEndpoint(
        "/app/apple/nonce",
        { method: "POST" },
        async (ctx) => {
          const nonce = randomBytes(32).toString("base64url")
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: identifier(nonce),
            value: "1",
            expiresAt: new Date(Date.now() + NONCE_SECONDS * 1000),
          })
          return ctx.json({ nonce })
        }
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => ID_TOKEN_ROUTES.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const body = ctx.body as
              { provider?: unknown; idToken?: { nonce?: unknown } } | undefined
            if (body?.provider !== "apple" || !body.idToken) return
            const nonce = body.idToken.nonce
            if (typeof nonce !== "string" || !NONCE.test(nonce)) throw refused()
            // Spent whatever happens next; an expired one comes back null.
            const row =
              await ctx.context.internalAdapter.consumeVerificationValue(
                identifier(nonce)
              )
            if (!row) throw refused()
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin
}
