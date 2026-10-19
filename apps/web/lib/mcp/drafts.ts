import { and, eq, gt, lte } from "drizzle-orm"

import { lessonDraft, type Db } from "@workspace/db"

import { newToken } from "../publish/ids"

// Drafts for the MCP server. Writing a lesson is the slow part of a chat (every tool call sends
// the whole file again as output), so validate_lesson and publish_lesson keep what they were sent
// under a draft id, and later calls fix it with small patches instead of resending it.

export const DRAFT_TTL_SECONDS = 24 * 60 * 60

export interface DraftStore {
  /** Saves `text` under `id`, or under a new id when `id` is null; returns the id. */
  save(id: string | null, text: string): Promise<string>
  /** A draft that hasn't expired, or null. */
  get(id: string): Promise<string | null>
  delete(id: string): Promise<void>
  /** Deletes every expired draft, and says how many. */
  deleteExpired(): Promise<number>
}

export class PostgresDraftStore implements DraftStore {
  constructor(
    private db: Db,
    private now = () => Date.now()
  ) {}

  async save(id: string | null, text: string) {
    const now = new Date(this.now())
    const expiresAt = new Date(this.now() + DRAFT_TTL_SECONDS * 1000)
    const draftId = id ?? newToken()
    await this.db
      .insert(lessonDraft)
      .values({ id: draftId, text, createdAt: now, updatedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: lessonDraft.id,
        set: { text, updatedAt: now, expiresAt },
      })
    return draftId
  }

  async get(id: string) {
    const [row] = await this.db
      .select({ text: lessonDraft.text })
      .from(lessonDraft)
      .where(
        and(
          eq(lessonDraft.id, id),
          gt(lessonDraft.expiresAt, new Date(this.now()))
        )
      )
    return row?.text ?? null
  }

  async delete(id: string) {
    await this.db.delete(lessonDraft).where(eq(lessonDraft.id, id))
  }

  async deleteExpired() {
    const deleted = await this.db
      .delete(lessonDraft)
      .where(lte(lessonDraft.expiresAt, new Date(this.now())))
      .returning({ id: lessonDraft.id })
    return deleted.length
  }
}

// ---------- patches ----------

/**
 * One change to a lesson. `path` uses the checker's syntax (`bricks[2].options[0].feedback`), so
 * an issue's path can be patched as is. `set` replaces a value or adds a key (or appends at an
 * array's length); `insert` puts a new item into an array at that index; `remove` deletes a key
 * or an array item.
 */
export type Patch =
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; value: unknown }
  | { op: "remove"; path: string }

export class PatchError extends Error {}

/** Splits `bricks[2].options[0].feedback` into ["bricks", 2, "options", 0, "feedback"]. */
export function parsePath(path: string): (string | number)[] {
  const parts: (string | number)[] = []
  const re = /([^.[\]]+)|\[(\d+)\]/g
  const rest = path.trim()
  if (!rest) throw new PatchError("A patch needs a path.")
  let match: RegExpExecArray | null
  let consumed = 0
  while ((match = re.exec(rest))) {
    // Only dots may sit between parts: `a..b` or `a]b` isn't a path.
    const gap = rest.slice(consumed, match.index)
    if (gap !== "" && gap !== ".") throw new PatchError(`Bad path "${path}".`)
    const part = match[2] !== undefined ? Number(match[2]) : match[1]!
    if (part === "__proto__" || part === "constructor" || part === "prototype")
      throw new PatchError(`Bad path "${path}".`)
    parts.push(part)
    consumed = match.index + match[0].length
  }
  if (consumed !== rest.length || parts.length === 0)
    throw new PatchError(`Bad path "${path}".`)
  return parts
}

/** Applies patches in order to a copy of `data`. Throws a PatchError naming the first one that doesn't fit. */
export function applyPatches(data: unknown, patches: Patch[]): unknown {
  const root = structuredClone(data)
  patches.forEach((patch, i) => {
    try {
      applyOne(root, patch)
    } catch (e) {
      if (e instanceof PatchError)
        throw new PatchError(`Patch ${i + 1} (${patch.path}): ${e.message}`)
      throw e
    }
  })
  return root
}

function applyOne(root: unknown, patch: Patch) {
  const parts = parsePath(patch.path)
  const key = parts.pop()!
  let parent: unknown = root
  for (const part of parts) {
    parent = child(parent, part)
    if (parent === undefined) throw new PatchError("nothing at that path.")
  }
  if (Array.isArray(parent)) {
    if (typeof key !== "number")
      throw new PatchError("an array item needs an index, like [2].")
    const max = patch.op === "remove" ? parent.length - 1 : parent.length
    if (key > max) throw new PatchError(`index ${key} is past the end.`)
    if (patch.op === "remove") parent.splice(key, 1)
    else if (patch.op === "insert") parent.splice(key, 0, patch.value)
    else parent[key] = patch.value
    return
  }
  if (!isObject(parent) || typeof key !== "string")
    throw new PatchError("nothing at that path.")
  if (patch.op === "insert")
    throw new PatchError("insert only works on arrays; use set.")
  if (patch.op === "remove") {
    if (!(key in parent)) throw new PatchError("nothing at that path.")
    delete parent[key]
  } else parent[key] = patch.value
}

function child(value: unknown, part: string | number): unknown {
  if (Array.isArray(value))
    return typeof part === "number" ? value[part] : undefined
  if (isObject(value) && typeof part === "string")
    return Object.hasOwn(value, part) ? value[part] : undefined
  return undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
