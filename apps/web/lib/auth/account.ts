import { APIError } from "better-auth/api"
import { and, desc, eq, isNull, max } from "drizzle-orm"

import {
  account,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  type Db,
} from "@workspace/db"

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

// ---------- connected apps ----------
// The chat apps that logged in over OAuth (Claude.ai, ChatGPT, Claude Code): one consent row per
// app and user, written when the user answered Allow on /consent, and the refresh tokens the app
// has had since. Access tokens are JWTs that aren't stored, so the gate in front of /mcp checks
// the consent row on every call (lib/mcp/gate.ts): deleting it is what disconnects the app.

/** What the settings page shows for each app. */
export interface ConnectedApp {
  /** The consent row's id: what Disconnect takes, since a client id can be a URL. */
  id: string
  clientId: string
  /** The app as shown to the user: the host of a client identified by a URL, else its registered name. */
  name: string
  /** When the user allowed it. */
  allowedAt: string
  /** When it last got a token, by logging in or refreshing one; null when it never did. */
  lastUsedAt: string | null
}

/**
 * Who an OAuth client is, as shown to the user. A client that identifies itself with a Client ID
 * Metadata Document (Claude, ChatGPT) has a URL for an id: its host, since the document's own
 * name is self-asserted. A registered client is shown by the name it registered with.
 */
export function appLabel(clientId: string, name?: string | null): string {
  if (/^https:\/\//.test(clientId)) {
    try {
      return new URL(clientId).host
    } catch {
      // fall through to the name
    }
  }
  return name?.trim() || "A chat app"
}

/** GET /api/account/apps: the apps the user has allowed, newest first. */
export async function connectedApps(
  db: Db,
  userId: string
): Promise<ConnectedApp[]> {
  const consents = await db
    .select({
      id: oauthConsent.id,
      clientId: oauthConsent.clientId,
      name: oauthClient.name,
      createdAt: oauthConsent.createdAt,
    })
    .from(oauthConsent)
    .leftJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, userId))
    .orderBy(desc(oauthConsent.createdAt))
  if (consents.length === 0) return []
  // Every token the user's apps were issued, newest per app: a refresh token at log-in and at
  // each rotation, and an access token row when one is opaque (none is today, but the column's there).
  const [refreshed, accessed] = await Promise.all([
    db
      .select({ clientId: oauthRefreshToken.clientId, at: max(oauthRefreshToken.createdAt) })
      .from(oauthRefreshToken)
      .where(eq(oauthRefreshToken.userId, userId))
      .groupBy(oauthRefreshToken.clientId),
    db
      .select({ clientId: oauthAccessToken.clientId, at: max(oauthAccessToken.createdAt) })
      .from(oauthAccessToken)
      .where(eq(oauthAccessToken.userId, userId))
      .groupBy(oauthAccessToken.clientId),
  ])
  const lastUse = new Map<string, number>()
  for (const { clientId, at } of [...refreshed, ...accessed]) {
    const t = at ? new Date(at).getTime() : 0
    if (t > (lastUse.get(clientId) ?? 0)) lastUse.set(clientId, t)
  }
  return consents.map((c) => {
    const used = lastUse.get(c.clientId)
    return {
      id: c.id,
      clientId: c.clientId,
      name: appLabel(c.clientId, c.name),
      allowedAt: c.createdAt.toISOString(),
      lastUsedAt: used ? new Date(used).toISOString() : null,
    }
  })
}

/**
 * DELETE /api/account/apps/{id}: disconnects an app. Its consent goes, so the gate refuses the
 * access token it holds at once, and its refresh tokens are revoked, so it can't get another;
 * the app shows its log-in prompt again the next time the user keeps a lesson.
 */
export async function disconnectApp(
  db: Db,
  userId: string,
  consentId: string
): Promise<Reply> {
  const [consent] = await db
    .select({ clientId: oauthConsent.clientId })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.id, consentId), eq(oauthConsent.userId, userId)))
  if (!consent) {
    return {
      status: 404,
      body: { ok: false, error: "not_found", message: "That app isn't connected." },
    }
  }
  const mine = (table: typeof oauthRefreshToken | typeof oauthAccessToken) =>
    and(
      eq(table.userId, userId),
      eq(table.clientId, consent.clientId),
      isNull(table.revoked)
    )
  const now = new Date()
  await db.update(oauthRefreshToken).set({ revoked: now }).where(mine(oauthRefreshToken))
  await db.update(oauthAccessToken).set({ revoked: now }).where(mine(oauthAccessToken))
  await db
    .delete(oauthConsent)
    .where(
      and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, consent.clientId))
    )
  return { status: 200, body: { ok: true } }
}

/** Whether `userId` still allows `clientId`: what makes an OAuth token good, beyond its signature. */
export async function hasConsent(
  db: Db,
  userId: string,
  clientId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: oauthConsent.id })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
    .limit(1)
  return row !== undefined
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

// ---------- how the account logs in ----------
// Every account logs in with a code to its email (no account row). GitHub, when linked, is an
// `account` row with provider "github"; Better Auth's own routes link, unlink, and change the email.

/** When GitHub was linked to the account, or null when it isn't. */
export async function githubLinkedAt(
  db: Db,
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ createdAt: account.createdAt })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
  return row ? row.createdAt.toISOString() : null
}
