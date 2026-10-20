import { APIError } from "better-auth/api"

import type { Reply } from "@/lib/publish/handlers"
import { mcpPath } from "@/lib/publish/paths"

import type { Actor } from "./actor"
import { MCP_KEY_PERMISSIONS, MCP_KEY_PREFIX, type Auth } from "./auth"
import { normalizeHandle } from "./handle-rules"

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
      image: actor.image,
    },
  }
}

/**
 * PATCH /api/account with { handle }: sets the handle through Better Auth's updateUser, so the
 * session cookie's copy of the user refreshes too. The rules are checked in a database hook
 * (createAuth), which answers 422 for a bad handle and 409 for a taken one.
 */
export async function setHandle(
  auth: Auth,
  headers: Headers,
  input: unknown
): Promise<Reply> {
  const handle = normalizeHandle(typeof input === "string" ? input : "")
  let refreshed: Headers
  try {
    // The refreshed session cookie comes back in the headers; the caller sends it on.
    refreshed = (
      await auth.api.updateUser({ headers, body: { handle }, returnHeaders: true })
    ).headers
  } catch (e) {
    if (e instanceof APIError) {
      const code = (e.body as { code?: string } | undefined)?.code
      return {
        status: e.statusCode,
        body: {
          ok: false,
          error: code === "HANDLE_TAKEN" ? "handle_taken" : "invalid_handle",
          message: e.message,
        },
      }
    }
    throw e
  }
  return { status: 200, body: { ok: true, handle }, headers: refreshed }
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

/** GET /api/keys: the terminal keys. The MCP key is a different thing, shown by its own section. */
export async function listKeys(auth: Auth, headers: Headers): Promise<Reply> {
  const { apiKeys } = await auth.api.listApiKeys({ headers })
  const summaries = apiKeys.filter((k) => !isMcpKey(k)).map(summarize)
  return { status: 200, body: { ok: true, keys: summaries } }
}

type ListedKey = Awaited<
  ReturnType<Auth["api"]["listApiKeys"]>
>["apiKeys"][number]

const isMcpKey = (k: Pick<ListedKey, "prefix" | "start">) =>
  k.prefix === MCP_KEY_PREFIX || Boolean(k.start?.startsWith(MCP_KEY_PREFIX))

const summarize = (k: ListedKey): KeySummary => ({
  id: k.id,
  name: k.name,
  start: k.start,
  createdAt: new Date(k.createdAt).toISOString(),
  lastUsedAt: k.lastRequest ? new Date(k.lastRequest).toISOString() : null,
})

// ---------- the personal MCP URL ----------
// One key per account, with the `mcp` permission and its own prefix, that stands at the end of
// https://learn.ninja/mcp/{key}. It's a bearer secret: shown once when made, then only its start.

/** What the settings page knows about the account's MCP URL: never the key itself. */
export interface McpConnection {
  id: string
  /** The first characters of the key, e.g. "learn_mcp_ab12", for the masked URL. */
  start: string | null
  createdAt: string
  lastUsedAt: string | null
}

/** The account's MCP key, or null when none was made (or the last one was revoked). */
export async function mcpConnection(
  auth: Auth,
  headers: Headers
): Promise<McpConnection | null> {
  const { apiKeys } = await auth.api.listApiKeys({ headers })
  const [key] = apiKeys
    .filter(isMcpKey)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  if (!key) return null
  const { name: _name, ...rest } = summarize(key)
  return rest
}

/**
 * POST /api/account/mcp: makes the account's MCP URL, revoking any earlier one first (so it's
 * also "rotate"). The only call that returns the URL in the clear. Needs a browser session: a
 * key may not mint keys.
 */
export async function connectMcp(
  auth: Auth,
  headers: Headers,
  /** The session's user, already checked by the route: permissions can only be set from the server side, by user id. */
  userId: string,
  origin: string
): Promise<Reply> {
  await revokeMcpKeys(auth, headers)
  const created = await auth.api.createApiKey({
    body: {
      userId,
      name: "Chat app URL",
      prefix: MCP_KEY_PREFIX,
      permissions: MCP_KEY_PERMISSIONS,
    },
  })
  return {
    status: 201,
    body: {
      ok: true,
      id: created.id,
      url: origin + mcpPath(created.key),
      start: created.start,
      createdAt: new Date(created.createdAt).toISOString(),
    },
  }
}

/** DELETE /api/account/mcp: revokes the URL. Chat apps using it stop working at once. */
export async function disconnectMcp(
  auth: Auth,
  headers: Headers
): Promise<Reply> {
  await revokeMcpKeys(auth, headers)
  return { status: 200, body: { ok: true } }
}

async function revokeMcpKeys(auth: Auth, headers: Headers) {
  const { apiKeys } = await auth.api.listApiKeys({ headers })
  for (const key of apiKeys.filter(isMcpKey)) {
    await auth.api.deleteApiKey({ headers, body: { keyId: key.id } })
  }
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
