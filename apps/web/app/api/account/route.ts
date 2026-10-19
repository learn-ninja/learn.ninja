import { setHandle, whoami } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// GET /api/account: the signed-in user's email and handle (`learn whoami`).
// PATCH /api/account with { "handle": "…" }: choose or change the handle.

export async function GET(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    return actor ? whoami(actor) : SIGN_IN_REQUIRED
  })
}

export async function PATCH(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as { handle?: unknown }
    return setHandle(await getAuth(), req.headers, body.handle)
  })
}
