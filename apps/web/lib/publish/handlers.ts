import { checkDiagrams, prepareLesson } from "@workspace/player/prepare"
import {
  canUpgrade,
  LIMITS,
  SPEC_VERSION,
  upgradeLesson,
  validateLesson,
  type Issue,
  type Note,
} from "@workspace/spec"

import {
  hashToken,
  lessonPath,
  newLessonId,
  newToken,
  slugify,
  tokenMatches,
} from "./ids"
import type { RateLimiter } from "./rate-limit"
import { SKILL_UPDATE_COMMAND, skillInfo } from "../skill-version"
import {
  LESSON_TTL_SECONDS,
  type LessonStore,
  type StoredLesson,
} from "./store"

// The publish API's logic, independent of Next.js so it can be tested directly.

/** Spec versions the server accepts. Older skills keep working while they're listed here; older files are upgraded first. */
export const ACCEPTED_SPECS: string[] = [
  SPEC_VERSION,
  "0.6",
  "0.5",
  "0.4",
  "0.3",
  "0.2",
]

export {
  compareVersions,
  LATEST_SKILL_VERSION,
  SKILL_UPDATE_COMMAND,
} from "../skill-version"

export interface Deps {
  store: LessonStore
  limiter: RateLimiter
  /** Origin for the links the API returns, e.g. https://learn.example.com */
  origin: string
  now?: () => number
  /** The handle of a user, or null when they haven't picked one. Replies name the owner with it. */
  handleOf?: (userId: string) => Promise<string | null>
}

/** The path a claim link lives at. */
export const keepPath = (claimToken: string) => `/keep/${claimToken}`

export interface Reply {
  status: number
  body: Record<string, unknown>
  /** Headers to send with the reply (Better Auth's Set-Cookie when a session changed). */
  headers?: Headers
}

interface PublishRequest {
  /** The lesson file's text. */
  text: string
  /** Who's publishing, for rate limits (the client IP). */
  client: string
  /** The installed skill's version, from the x-learn-skill-version header. */
  skillVersion?: string | null
  /** The signed-in user (session cookie or API key), or null for an anonymous publish. */
  ownerId?: string | null
  /** The owner's handle when the caller already knows it (the route has the actor), so the reply needn't look it up. */
  ownerHandle?: string | null
  /**
   * Where an owned lesson starts: listed in Explore (the default) or link-only. A personal MCP URL
   * publishes unlisted, so half-finished drafts don't land in Explore. Ignored for anonymous lessons.
   */
  visibility?: "public" | "unlisted"
}

/** Checks size, JSON, spec version, the spec's rules, and that diagrams draw. Returns the lesson or an error reply. */
async function checkLessonText(text: string, skillVersion?: string | null) {
  const skill = skillInfo(skillVersion)
  if (new TextEncoder().encode(text).length > LIMITS.lessonBytes) {
    return {
      error: {
        status: 413,
        body: {
          ok: false,
          error: "too_large",
          message: `Lesson files can be at most ${LIMITS.lessonBytes / 1024} KB.`,
          skill,
        },
      },
    }
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    // validateLesson reports the JSON error below.
  }
  const spec = (data as { spec?: unknown } | undefined)?.spec
  if (typeof spec === "string" && !ACCEPTED_SPECS.includes(spec)) {
    return {
      error: {
        status: 422,
        body: {
          ok: false,
          error: "unsupported_spec",
          message: `This server accepts spec ${ACCEPTED_SPECS.join(", ")}, not ${spec}. Update the skill: ${SKILL_UPDATE_COMMAND}`,
          accepted: ACCEPTED_SPECS,
          skill: {
            ...skill,
            updateAvailable: true,
            updateCommand: SKILL_UPDATE_COMMAND,
          },
        },
      },
    }
  }
  const result = validateLesson(canUpgrade(data) ? upgradeLesson(data) : text)
  // Diagrams are checked by compiling their D2, which needs the server, not just the spec's rules.
  const issues = result.ok ? await checkDiagrams(result.lesson) : result.issues
  if (!result.ok || issues.length) {
    return {
      error: {
        status: 422,
        body: {
          ok: false,
          error: "invalid_lesson",
          message:
            "The lesson doesn't match the spec. Fix these issues and publish again.",
          issues: issues satisfies Issue[],
          skill,
        },
      },
    }
  }
  // Notes don't stop a publish: what the checker tidied (a tag's spelling), for the agent to know.
  return { lesson: result.lesson, skill, notes: result.notes satisfies Note[] }
}

/** The `notes` field of a reply, present only when the checker has something to say. */
const notesField = (notes: Note[]) => (notes.length ? { notes } : {})

/** POST /api/validate: the checks publishing runs, without storing anything. Older CLIs get the newest rules this way. */
export async function checkLesson(
  req: PublishRequest,
  deps: Pick<Deps, "limiter">
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client))) {
    return {
      status: 429,
      body: {
        ok: false,
        error: "rate_limited",
        message: "Too many checks from here recently. Try again later.",
      },
    }
  }
  const checked = await checkLessonText(req.text, req.skillVersion)
  if ("error" in checked) return checked.error!
  return {
    status: 200,
    body: {
      ok: true,
      spec: checked.lesson.spec,
      ...notesField(checked.notes),
      skill: checked.skill,
    },
  }
}

export async function publishLesson(
  req: PublishRequest,
  deps: Deps
): Promise<Reply> {
  const now = deps.now?.() ?? Date.now()
  if (!(await deps.limiter.allow(req.client))) {
    return {
      status: 429,
      body: {
        ok: false,
        error: "rate_limited",
        message:
          "Too many lessons published from here recently. Try again later.",
      },
    }
  }
  const checked = await checkLessonText(req.text, req.skillVersion)
  if ("error" in checked) return checked.error!

  const { lesson, skill, notes } = checked
  const editToken = newToken()
  // An owned lesson never expires and needs no claim token; an anonymous one lasts 7 days and
  // carries a token that moves it into an account later (`learn login`, or the /keep link).
  const owner = req.ownerId ?? null
  const claimToken = owner ? null : newToken()
  const record: StoredLesson = {
    id: newLessonId(),
    slug: slugify(lesson.title),
    spec: lesson.spec,
    lesson,
    prepared: await prepareLesson(lesson),
    editTokenHash: hashToken(editToken),
    claimTokenHash: claimToken ? hashToken(claimToken) : null,
    ownerId: owner,
    // An owned lesson is listed in Explore straight away unless the caller says otherwise (the
    // owner can switch it in their settings); an anonymous one stays link-only until it's kept.
    visibility: owner ? (req.visibility ?? "public") : "unlisted",
    hidden: false,
    views: 0,
    likes: 0,
    createdAt: now,
    expiresAt: owner ? null : now + LESSON_TTL_SECONDS * 1000,
  }
  await deps.store.create(record)
  return {
    status: 201,
    body: {
      ok: true,
      id: record.id,
      url: deps.origin + lessonPath(record.slug, record.id),
      editToken,
      ...(claimToken
        ? { claimToken, claimUrl: deps.origin + keepPath(claimToken) }
        : {}),
      ...(await ownership(record, deps, req.ownerHandle)),
      spec: record.spec,
      ...notesField(notes),
      skill,
    },
  }
}

/**
 * Replaces a published lesson. The edit token from publishing proves the right to change it; so
 * does being its owner (`actorId` equal to the lesson's `ownerId`), which is how a chat app on a
 * personal MCP URL edits a lesson whose token lives in another chat.
 */
export async function updateLesson(
  req: PublishRequest & {
    id: string
    editToken: string | null
    /** The signed-in user, when the caller has one; an owner needs no token. */
    actorId?: string | null
  },
  deps: Deps
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client))) {
    return {
      status: 429,
      body: {
        ok: false,
        error: "rate_limited",
        message: "Too many updates from here recently. Try again later.",
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
  if (!mayEdit(existing, req.editToken, req.actorId)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: "unauthorized",
        message: req.editToken
          ? "The edit token doesn't match this lesson."
          : "This lesson isn't in your account, and no edit token was sent.",
      },
    }
  }
  const checked = await checkLessonText(req.text, req.skillVersion)
  if ("error" in checked) return checked.error!

  const { lesson, skill, notes } = checked
  const record: StoredLesson = {
    ...existing,
    slug: slugify(lesson.title),
    spec: lesson.spec,
    lesson,
    prepared: await prepareLesson(lesson),
    updatedAt: deps.now?.() ?? Date.now(),
  }
  await deps.store.update(record)
  return {
    status: 200,
    body: {
      ok: true,
      id: record.id,
      url: deps.origin + lessonPath(record.slug, record.id),
      ...(await ownership(record, deps)),
      spec: record.spec,
      ...notesField(notes),
      skill,
    },
  }
}

/** Whether the edit token, or the signed-in user's ownership, allows changing `existing`. */
export function mayEdit(
  existing: Pick<StoredLesson, "editTokenHash" | "ownerId">,
  editToken: string | null | undefined,
  actorId?: string | null
): boolean {
  if (editToken && tokenMatches(editToken, existing.editTokenHash)) return true
  return Boolean(actorId) && existing.ownerId === actorId
}

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
  // Reply from the row as the store left it, not from `existing`: claiming may change more than the owner (its visibility, say).
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
 * (`owner.handle`, so a client can say "saved to @handle"), and whether it's listed in Explore
 * (`visibility`).
 */
async function ownership(
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

function isoOrNull(ms: number | null) {
  return ms === null ? null : new Date(ms).toISOString()
}
