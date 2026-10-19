import type { Auth } from "./auth"

// Who's making a request: a signed-in user (session cookie) or a terminal (x-api-key), or nobody.

export interface Actor {
  userId: string
  email: string
  name: string
  handle: string | null
  image: string | null
  /** True when the request carried an API key rather than a browser session. */
  viaApiKey: boolean
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("The API key doesn't work. Run `learn login` again to get a new one.")
  }
}

/**
 * The actor behind `headers`, or null for an anonymous request. A request with no cookie and no
 * key skips Better Auth entirely, so anonymous publishing costs nothing extra. A key that doesn't
 * work throws InvalidApiKeyError rather than falling back to anonymous: a lesson published that
 * way would silently end up unowned.
 */
export async function getActor(
  auth: Auth,
  headers: Headers
): Promise<Actor | null> {
  const viaApiKey = headers.has("x-api-key")
  if (!viaApiKey && !headers.has("cookie")) return null
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

function isApiError(e: unknown): e is { statusCode: number } {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    typeof (e as { statusCode: unknown }).statusCode === "number"
  )
}
