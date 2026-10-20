import { isApiError } from "../auth/actor"
import type { Auth } from "../auth/auth"
import { claimLesson, type Deps, type Reply } from "../publish/handlers"
import { tokenMatches } from "../publish/ids"

// Keeping a lesson from inside a chat, with an email code: what `learn login` does in the
// terminal, as one MCP tool. The first call sends a six-digit code to the address; the second,
// with the code, signs in on the server, moves the lesson into that account, and drops the
// session. No secret reaches the chat: the code is spent at once, and the session's cookie is
// never returned.

export interface KeepDeps extends Pick<Deps, "store" | "origin" | "handleOf"> {
  auth: Auth
  /** Per-client limit on these calls, on top of Better Auth's per-address limit on codes. */
  limiter: Deps["limiter"]
}

export interface KeepRequest {
  id: string
  editToken: string
  email: string
  /** The six-digit code from the email; absent on the first call. */
  code?: string | null
  /** Who's calling, for rate limits. */
  client: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Sends a sign-in code to `email` (no `code`), or signs in with it and keeps the lesson. Either
 * way the lesson must exist, be anonymous, and match the edit token first, so the tool can't be
 * used to send codes on someone else's behalf for lessons the caller can't touch.
 */
export async function keepByEmail(
  req: KeepRequest,
  deps: KeepDeps
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client))) {
    return {
      status: 429,
      body: {
        ok: false,
        error: "rate_limited",
        message: "Too many requests from here recently. Try again later.",
      },
    }
  }
  const email = req.email.trim().toLowerCase()
  if (!EMAIL.test(email)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "bad_input",
        message: "That doesn't look like an email address.",
      },
    }
  }
  const existing = await deps.store.get(req.id)
  if (!existing) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "not_found",
        message:
          "This lesson doesn't exist or has expired. Publish it again to get a new link.",
      },
    }
  }
  if (!tokenMatches(req.editToken, existing.editTokenHash)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: "unauthorized",
        message: "The edit token doesn't match this lesson.",
      },
    }
  }
  if (existing.ownerId) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "already_claimed",
        message: "This lesson is already saved to an account.",
      },
    }
  }

  const code = req.code?.trim()
  if (!code) return sendCode(email, deps)

  let userId: string
  try {
    const { headers, response } = await deps.auth.api.signInEmailOTP({
      body: { email, otp: code },
      returnHeaders: true,
    })
    userId = response.user.id
    // The session proved the email; nothing else needs it. Best effort: an orphan expires anyway,
    // and its token never left this function.
    const cookie = headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
    if (cookie) {
      await deps.auth.api
        .signOut({ headers: new Headers({ cookie }) })
        .catch(() => {})
    }
  } catch (e) {
    if (!isApiError(e)) throw e
    // A wrong or expired code, too many tries, or a banned account: Better Auth's own words.
    return {
      status: e.statusCode,
      body: {
        ok: false,
        error: "sign_in_failed",
        message: `${e.message || "Couldn't sign in."} Codes work for 5 minutes and three tries; call again without a code to send a new one.`,
      },
    }
  }
  return claimLesson(
    { id: req.id, editToken: req.editToken, ownerId: userId },
    deps
  )
}

async function sendCode(email: string, deps: KeepDeps): Promise<Reply> {
  try {
    await deps.auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
  } catch (e) {
    if (!isApiError(e)) throw e
    return {
      status: e.statusCode,
      body: {
        ok: false,
        error: e.statusCode === 429 ? "rate_limited" : "send_failed",
        message: e.message || "Couldn't send the code.",
      },
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      sent: true,
      email,
      message: `Sent a six-digit code to ${email}. It works for 5 minutes. Ask the user for it, then call keep_lesson again with the same id, editToken, and email, plus the code.`,
    },
  }
}
