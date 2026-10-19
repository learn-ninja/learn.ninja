import { createKey, listKeys } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// GET /api/keys: the session's API keys, without the keys themselves.
// POST /api/keys with { "name": "…" }: a new key, returned once in the clear. Needs a browser
// session, not another key: `learn login` signs in with an email code first.

export async function GET(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    return actor ? listKeys(await getAuth(), req.headers) : SIGN_IN_REQUIRED
  })
}

export async function POST(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor || actor.viaApiKey) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as { name?: unknown }
    return createKey(await getAuth(), req.headers, body.name)
  })
}
