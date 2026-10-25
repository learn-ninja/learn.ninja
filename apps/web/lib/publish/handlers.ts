import { checkVisuals, prepareLesson } from "@workspace/player/prepare"
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
import { isoOrNull, keepPath, ownership } from "./claims"
import type { RateLimiter } from "./rate-limit"
import { cleanOrigin } from "../origin"
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
  claimLesson,
  expireLessons,
  isCronRequest,
  keepPath,
  reissueClaimToken,
} from "./claims"

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
  /** The logged-in user (session cookie or API key), or null for an anonymous publish. */
  ownerId?: string | null
  /** The owner's handle when the caller already knows it (the route has the actor), so the reply needn't look it up. */
  ownerHandle?: string | null
  /** The app or agent publishing (an MCP client's name, or the CLI's x-learn-agent header), shown on cards. */
  origin?: string | null
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
  // Diagrams, molecules, and icons are checked on the server: D2 must compile, SMILES must read,
  // and icons must exist in the kit.
  const issues = result.ok ? await checkVisuals(result.lesson) : result.issues
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
    // Every lesson starts private (link only); its owner publishes it to Explore when it's ready.
    visibility: "unlisted",
    hidden: false,
    views: 0,
    likes: 0,
    origin: cleanOrigin(req.origin),
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
    /** The logged-in user, when the caller has one; an owner needs no token. */
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

/** Whether the edit token, or the logged-in user's ownership, allows changing `existing`. */
export function mayEdit(
  existing: Pick<StoredLesson, "editTokenHash" | "ownerId">,
  editToken: string | null | undefined,
  actorId?: string | null
): boolean {
  if (editToken && tokenMatches(editToken, existing.editTokenHash)) return true
  return Boolean(actorId) && existing.ownerId === actorId
}
