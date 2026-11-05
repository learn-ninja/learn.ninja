import type { Strings } from "@workspace/player-core/strings"

// What the log-in screen says when Better Auth refuses: the web's login page shows the server's
// English message as it comes; the app says the same things in the learner's language, by the
// error's code (Better Auth's email OTP codes, and the 429 of the per-address limit in
// apps/web/lib/auth/auth.ts or its per-IP rate limit).

export interface AuthError {
  status?: number
  code?: string
  message?: string
}

export function signInError(error: AuthError, t: Strings): string {
  const s = t.signIn
  if (error.status === 429) return s.tooManyCodes
  switch (error.code) {
    case "INVALID_OTP":
      return s.wrongCode
    case "OTP_EXPIRED":
      return s.expiredCode
    case "TOO_MANY_ATTEMPTS":
      return s.tooManyTries
    case "INVALID_EMAIL":
      return s.badEmail
    default:
      return s.failed
  }
}

/** A plausible address, checked before asking the server (which checks again). */
export const looksLikeEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
