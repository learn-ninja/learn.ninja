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
import {
  LESSON_TTL_SECONDS,
  type LessonStore,
  type StoredLesson,
} from "./store"

// The publish API's logic, independent of Next.js so it can be tested directly.

/** Spec versions the server accepts. Older skills keep working while they're listed here; older files are upgraded first. */
export const ACCEPTED_SPECS: string[] = [SPEC_VERSION, "0.2"]

/** The current skill version. Bump it when the skill changes; older skills are told to update. */
export const LATEST_SKILL_VERSION = "0.3.1"
export const SKILL_UPDATE_COMMAND = "npx skills add https://learn.ninja -g"

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

function skillInfo(version?: string | null) {
  const updateAvailable =
    Boolean(version) && compareVersions(version!, LATEST_SKILL_VERSION) < 0
  return {
    latest: LATEST_SKILL_VERSION,
    updateAvailable,
    ...(updateAvailable ? { updateCommand: SKILL_UPDATE_COMMAND } : {}),
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
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
  await deps.store.create(record, LESSON_TTL_SECONDS)
  return {
    status: 201,
    body: {
      ok: true,
      id: record.id,
      url: deps.origin + lessonPath(record.slug, record.id),
      editToken,
      expiresAt: new Date(record.expiresAt).toISOString(),
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
      expiresAt: new Date(record.expiresAt).toISOString(),
      spec: record.spec,
      skill,
    },
  }
}
