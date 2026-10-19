import { eq } from "drizzle-orm"

import { user, type Db } from "@workspace/db"

import type { Reply } from "@/lib/publish/handlers"

import type { Actor } from "./actor"
import type { Auth } from "./auth"
import { findByHandle, handleProblem, normalizeHandle } from "./handles"

// The account API behind /settings and the CLI's `whoami` and `login`: who am I, my handle, and
// my API keys. Independent of Next.js so it can be tested directly.

/** GET /api/account */
export function whoami(actor: Actor): Reply {
  return {
    status: 200,
    body: {
      ok: true,
      email: actor.email,
      handle: actor.handle,
      name: actor.name,
    },
  }
}

/** PATCH /api/account with { handle }: sets the handle, if it's free and follows the rules. */
export async function setHandle(
  db: Db,
  actor: Actor,
  input: unknown
): Promise<Reply> {
  const handle = normalizeHandle(typeof input === "string" ? input : "")
  const problem = handleProblem(handle)
  if (problem) {
    return {
      status: 422,
      body: { ok: false, error: "invalid_handle", message: problem },
    }
  }
  const taken = await findByHandle(db, handle)
  if (taken && taken.id !== actor.userId) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "handle_taken",
        message: "Someone already has that handle.",
      },
    }
  }
  await db
    .update(user)
    .set({ handle, updatedAt: new Date() })
    .where(eq(user.id, actor.userId))
  return { status: 200, body: { ok: true, handle } }
}

/** What the settings page shows for each key: never the key itself. */
export interface KeySummary {
  id: string
  name: string | null
  /** The first characters, e.g. "learn_ab12". */
  start: string | null
  createdAt: string
  lastUsedAt: string | null
}

/** GET /api/keys */
export async function listKeys(auth: Auth, headers: Headers): Promise<Reply> {
  const { apiKeys } = await auth.api.listApiKeys({ headers })
  const summaries: KeySummary[] = apiKeys.map((k) => ({
    id: k.id,
    name: k.name,
    start: k.start,
    createdAt: new Date(k.createdAt).toISOString(),
    lastUsedAt: k.lastRequest ? new Date(k.lastRequest).toISOString() : null,
  }))
  return { status: 200, body: { ok: true, keys: summaries } }
}

export const KEY_NAME_MAX = 32

/** POST /api/keys with { name }: the only call that returns a key in the clear. */
export async function createKey(
  auth: Auth,
  headers: Headers,
  input: unknown
): Promise<Reply> {
  const name =
    typeof input === "string" ? input.trim().slice(0, KEY_NAME_MAX) : ""
  const created = await auth.api.createApiKey({
    headers,
    body: { name: name || "Unnamed key" },
  })
  return {
    status: 201,
    body: {
      ok: true,
      id: created.id,
      name: created.name,
      key: created.key,
      start: created.start,
      createdAt: new Date(created.createdAt).toISOString(),
    },
  }
}

/** DELETE /api/keys/{id} */
export async function deleteKey(
  auth: Auth,
  headers: Headers,
  keyId: string
): Promise<Reply> {
  await auth.api.deleteApiKey({ headers, body: { keyId } })
  return { status: 200, body: { ok: true } }
}
