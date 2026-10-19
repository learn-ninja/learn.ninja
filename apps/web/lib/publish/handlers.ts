import { checkDiagrams, prepareLesson } from "@workspace/player/prepare"
import {
  canUpgrade,
  LIMITS,
  SPEC_VERSION,
  upgradeLesson,
  validateLesson,
  type Issue,
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
export const ACCEPTED_SPECS: string[] = [SPEC_VERSION, "0.4", "0.3", "0.2"]

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
  return { lesson: result.lesson, skill }
}

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
    body: { ok: true, spec: checked.lesson.spec, skill: checked.skill },
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

  const { lesson, skill } = checked
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
    // Link-only until the owner lists it from their settings; anonymous lessons stay that way.
    visibility: "unlisted",
    hidden: false,
    plays: 0,
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
      owned: Boolean(owner),
      expiresAt: isoOrNull(record.expiresAt),
      spec: record.spec,
      skill,
    },
  }
}

export async function updateLesson(
  req: PublishRequest & { id: string; editToken: string | null },
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
  const checked = await checkLessonText(req.text, req.skillVersion)
  if ("error" in checked) return checked.error!

  const { lesson, skill } = checked
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
      owned: Boolean(record.ownerId),
      expiresAt: isoOrNull(record.expiresAt),
      spec: record.spec,
      skill,
    },
  }
}

/**
 * Moves an anonymous lesson into `ownerId`'s account: POST /api/lessons/{id}/claim with the claim
 * token, or the /keep/{token} page, which has only the token. The lesson then never expires.
 */
export async function claimLesson(
  req: { id?: string; claimToken: string; ownerId: string },
  deps: Pick<Deps, "store" | "origin">
): Promise<Reply> {
  const hash = hashToken(req.claimToken)
  const existing = req.id
    ? await deps.store.get(req.id)
    : await deps.store.getByClaimTokenHash(hash)
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
      ? kept(existing, deps.origin)
      : {
          status: 409,
          body: {
            ok: false,
            error: "already_claimed",
            message: "This lesson already belongs to another account.",
          },
        }
  }
  if (
    !existing.claimTokenHash ||
    !tokenMatches(req.claimToken, existing.claimTokenHash)
  ) {
    return {
      status: 401,
      body: {
        ok: false,
        error: "unauthorized",
        message: "The claim token doesn't match this lesson.",
      },
    }
  }
  await deps.store.claim(existing.id, req.ownerId)
  return kept({ ...existing, ownerId: req.ownerId, expiresAt: null }, deps.origin)
}

function kept(record: StoredLesson, origin: string): Reply {
  return {
    status: 200,
    body: {
      ok: true,
      id: record.id,
      url: origin + lessonPath(record.slug, record.id),
      title: record.lesson.title,
      owned: true,
      expiresAt: null,
    },
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
