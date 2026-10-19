import { prepareLesson } from "@workspace/player/prepare"
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
  newEditToken,
  newLessonId,
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
export const ACCEPTED_SPECS: string[] = [SPEC_VERSION, "0.3", "0.2"]

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

export interface Reply {
  status: number
  body: Record<string, unknown>
}

interface PublishRequest {
  /** The lesson file's text. */
  text: string
  /** Who's publishing, for rate limits (the client IP). */
  client: string
  /** The installed skill's version, from the x-learn-skill-version header. */
  skillVersion?: string | null
}

/** Checks size, JSON, spec version, and the spec's rules. Returns the lesson or an error reply. */
function checkLessonText(text: string, skillVersion?: string | null) {
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
  if (!result.ok) {
    return {
      error: {
        status: 422,
        body: {
          ok: false,
          error: "invalid_lesson",
          message:
            "The lesson doesn't match the spec. Fix these issues and publish again.",
          issues: result.issues satisfies Issue[],
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
  const checked = checkLessonText(req.text, req.skillVersion)
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
  const checked = checkLessonText(req.text, req.skillVersion)
  if ("error" in checked) return checked.error!

  const { lesson, skill } = checked
  const editToken = newEditToken()
  const record: StoredLesson = {
    id: newLessonId(),
    slug: slugify(lesson.title),
    spec: lesson.spec,
    lesson,
    prepared: await prepareLesson(lesson),
    editTokenHash: hashToken(editToken),
    createdAt: now,
    expiresAt: now + LESSON_TTL_SECONDS * 1000,
  }
  await deps.store.create(record)
  return {
    status: 201,
    body: {
      ok: true,
      id: record.id,
      url: deps.origin + lessonPath(record.slug, record.id),
      editToken,
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
  const checked = checkLessonText(req.text, req.skillVersion)
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
      expiresAt: isoOrNull(record.expiresAt),
      spec: record.spec,
      skill,
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
