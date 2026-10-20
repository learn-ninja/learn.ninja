import { eq } from "drizzle-orm"

import { user, type Db } from "@workspace/db"

import {
  MCP_KEY_AS_HEADER,
  MCP_KEY_PERMISSIONS,
  MCP_KEY_PREFIX,
  type Auth,
} from "./auth"

// Who's making a request: a signed-in user (session cookie), a terminal (x-api-key), a chat app
// on its personal MCP URL (the key in the path), or nobody.

export interface Actor {
  userId: string
  email: string
  name: string
  handle: string | null
  image: string | null
  /** True when the request carried an API key rather than a browser session. */
  viaApiKey: boolean
}

/** The actor behind a personal MCP URL: the account, and which key it came through (rate limits key on it). */
export interface KeyActor extends Actor {
  keyId: string
}

export class InvalidApiKeyError extends Error {
  constructor(
    message = "The API key doesn't work. Run `learn login` again to get a new one."
  ) {
    super(message)
  }
}

/** What a chat app is told when the key in its URL doesn't work. */
export const BAD_MCP_URL =
  "This MCP URL doesn't work: its key was revoked, replaced, or never existed. Make a new one at learn.ninja/settings, or use https://learn.ninja/mcp without an account."

/**
 * The actor behind `headers`, or null for an anonymous request. A request with no cookie and no
 * key skips Better Auth entirely, so anonymous publishing costs nothing extra. A key that doesn't
 * work throws InvalidApiKeyError rather than falling back to anonymous: a lesson published that
 * way would silently end up unowned. An MCP key is refused here too: it's a bearer for one URL,
 * not an account key (getActorByKey is its only way in).
 */
export async function getActor(
  auth: Auth,
  headers: Headers
): Promise<Actor | null> {
  const apiKey = headers.get("x-api-key")
  const viaApiKey = apiKey !== null
  if (!viaApiKey && !headers.has("cookie")) return null
  if (apiKey?.startsWith(MCP_KEY_PREFIX))
    throw new InvalidApiKeyError(MCP_KEY_AS_HEADER)
  let result: Awaited<ReturnType<Auth["api"]["getSession"]>>
  try {
    result = await auth.api.getSession({ headers })
  } catch (e) {
    // Better Auth answers a bad key with an APIError (403 for an unknown key, 400 for a malformed
    // one). Checked by shape: the bundler can hold more than one copy of the class.
    if (viaApiKey && isApiError(e)) throw new InvalidApiKeyError()
    throw e
  }
  if (!result) {
    if (viaApiKey) throw new InvalidApiKeyError()
    return null
  }
  const { user } = result
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    handle: user.handle ?? null,
    image: user.image ?? null,
    viaApiKey,
  }
}

/**
 * The account behind the key in a personal MCP URL (/mcp/{key}). Only a key made for that
 * purpose works: the right prefix and the `mcp` permission, so a terminal key pasted into a URL
 * is refused, as a revoked or made-up key is. Never falls back to anonymous: a lesson published
 * that way would silently end up unowned. Checked by value through Better Auth's verify endpoint,
 * not as a session: the auth hook refuses MCP keys sent as x-api-key everywhere else.
 */
export async function getActorByKey(
  auth: Auth,
  db: Db,
  key: string
): Promise<KeyActor> {
  if (!key.startsWith(MCP_KEY_PREFIX)) throw new InvalidApiKeyError(BAD_MCP_URL)
  let verified: Awaited<ReturnType<Auth["api"]["verifyApiKey"]>>
  try {
    verified = await auth.api.verifyApiKey({
      body: { key, permissions: MCP_KEY_PERMISSIONS },
    })
  } catch (e) {
    if (isApiError(e)) throw new InvalidApiKeyError(BAD_MCP_URL)
    throw e
  }
  if (!verified.valid || !verified.key) throw new InvalidApiKeyError(BAD_MCP_URL)
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      image: user.image,
      banned: user.banned,
    })
    .from(user)
    .where(eq(user.id, verified.key.referenceId))
  // A banned account keeps its keys but can't act through them, as it can't sign in.
  if (!row || row.banned) throw new InvalidApiKeyError(BAD_MCP_URL)
  return {
    userId: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle ?? null,
    image: row.image ?? null,
    viaApiKey: true,
    keyId: verified.key.id,
  }
}

export function isApiError(e: unknown): e is { statusCode: number; message: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    typeof (e as { statusCode: unknown }).statusCode === "number"
  )
}
