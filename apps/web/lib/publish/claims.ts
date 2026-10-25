import { hashToken, lessonPath, newToken, tokenMatches } from "./ids"
import type { Deps, Reply } from "./handlers"
import type { StoredLesson } from "./store"

// Keeping, re-issuing, and expiring lessons: the publish API's light half. It imports nothing that
// checks or prepares a lesson (KaTeX, Shiki, D2…), so the routes that only claim or expire start fast.

/** The path a claim link lives at. */
export const keepPath = (claimToken: string) => `/keep/${claimToken}`

/**
 * Moves an anonymous lesson into `ownerId`'s account: POST /api/lessons/{id}/claim with the claim
 * token or the edit token, or the /keep/{token} page, which has only the claim token. The lesson
 * then never expires. The edit token counts as proof because whoever can rewrite a lesson is its
 * author in every way that matters; it's how a lesson is kept once the claim token is gone.
 */
export async function claimLesson(
  req: {
    id?: string
    claimToken?: string | null
    editToken?: string | null
    ownerId: string
  },
  deps: Pick<Deps, "store" | "origin" | "handleOf">
): Promise<Reply> {
  const existing = req.id
    ? await deps.store.get(req.id)
    : req.claimToken
      ? await deps.store.getByClaimTokenHash(hashToken(req.claimToken))
      : null
  if (!existing) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "not_found",
        message:
          "This lesson doesn't exist, has expired, or was already saved to an account.",
      },
    }
  }
  if (existing.ownerId) {
    return existing.ownerId === req.ownerId
      ? kept(existing, deps)
      : {
          status: 409,
          body: {
            ok: false,
            error: "already_claimed",
            message: "This lesson already belongs to another account.",
          },
        }
  }
  const byClaim =
    Boolean(req.claimToken) &&
    Boolean(existing.claimTokenHash) &&
    tokenMatches(req.claimToken!, existing.claimTokenHash!)
  const byEdit =
    Boolean(req.editToken) &&
    tokenMatches(req.editToken!, existing.editTokenHash)
  if (!byClaim && !byEdit) {
    return {
      status: 401,
      body: {
        ok: false,
        error: "unauthorized",
        message: `The ${req.editToken && !req.claimToken ? "edit" : "claim"} token doesn't match this lesson.`,
      },
    }
  }
  // Reply from the row as the store left it, not from `existing`: claiming changes more than the owner (its expiry, say).
  return kept(await deps.store.claim(existing.id, req.ownerId), deps)
}

async function kept(
  record: StoredLesson,
  deps: Pick<Deps, "origin" | "handleOf">
): Promise<Reply> {
  return {
    status: 200,
    body: {
      ok: true,
      id: record.id,
      url: deps.origin + lessonPath(record.slug, record.id),
      title: record.lesson.title,
      ...(await ownership(record, deps)),
    },
  }
}

/**
 * Issues a new claim token for an anonymous lesson to whoever holds its edit token, so the lesson
 * can still be kept when the one from publishing is gone (a closed chat, a deleted state file, or
 * an older tool that never saved it). The MCP `keep_lesson` tool is built on it. The old claim
 * token stops working.
 */
export async function reissueClaimToken(
  req: { id: string; editToken: string | null; client: string },
  deps: Pick<Deps, "store" | "origin" | "limiter">
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
  if (!req.editToken || !tokenMatches(req.editToken, existing.editTokenHash)) {
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
  const claimToken = newToken()
  // The row may have been claimed since it was read; then there's nothing to re-issue.
  if (!(await deps.store.setClaimToken(existing.id, hashToken(claimToken)))) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "already_claimed",
        message: "This lesson is already saved to an account.",
      },
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      id: existing.id,
      url: deps.origin + lessonPath(existing.slug, existing.id),
      title: existing.lesson.title,
      claimToken,
      claimUrl: deps.origin + keepPath(claimToken),
      expiresAt: isoOrNull(existing.expiresAt),
    },
  }
}

/**
 * The reply fields that say where a lesson stands: `owned`, when it expires, who owns it
 * (`owner.handle`, so a client can say "saved to @handle"), and whether it's published in Explore
 * (`visibility`).
 */
export async function ownership(
  record: Pick<StoredLesson, "ownerId" | "expiresAt" | "visibility">,
  deps: Pick<Deps, "handleOf">,
  /** The owner's handle when the caller knows it; undefined means look it up. */
  handle?: string | null
) {
  const owner = record.ownerId
    ? {
        handle:
          (handle !== undefined
            ? handle
            : await deps.handleOf?.(record.ownerId)) ?? null,
      }
    : null
  return {
    owned: owner !== null,
    expiresAt: isoOrNull(record.expiresAt),
    owner,
    visibility: record.visibility,
  }
}

/** Whether a request carries the CRON_SECRET as a bearer token, as Vercel Cron sends it. Refuses everything when no secret is set. */
export function isCronRequest(
  authorization: string | null,
  secret = process.env.CRON_SECRET
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false
  return tokenMatches(authorization.slice(7), hashToken(secret))
}

/** GET /api/cron/expire: deletes lessons whose expiry has passed. */
export async function expireLessons(deps: Pick<Deps, "store">): Promise<Reply> {
  const deleted = await deps.store.deleteExpired()
  return { status: 200, body: { ok: true, deleted } }
}

export function isoOrNull(ms: number | null) {
  return ms === null ? null : new Date(ms).toISOString()
}
