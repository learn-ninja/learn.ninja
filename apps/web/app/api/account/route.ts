import { deleteAccount, setHandle, whoami } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { revalidateExplore } from "@/lib/explore/cache"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// GET /api/account: the logged-in user's email and handle (`learn whoami`).
// PATCH /api/account with { "handle": "…" }: choose or change the handle.
// DELETE /api/account with { "confirm": "<the account's email>" }: delete the account and
// everything it owns, for good (Settings on the website and in the iOS app). Session only.

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

export async function DELETE(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown }
    const reply = await deleteAccount(
      await getAuth(),
      await getDb(),
      actor,
      req.headers,
      body.confirm
    )
    // Their lessons and profile leave Explore at once.
    if (reply.status === 200) revalidateExplore("now")
    return reply
  })
}
