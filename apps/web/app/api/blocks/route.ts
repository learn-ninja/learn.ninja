import { blockUser, listBlocks } from "@/lib/explore/blocks"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// GET /api/blocks lists the people the logged-in user blocked (Settings); POST /api/blocks with
// { "userId": "…" } blocks someone, so their lessons stop showing to the user (lib/explore/blocks.ts).

export async function GET(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return listBlocks(actor.userId, await getDb())
  })
}

export async function POST(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as { userId?: unknown }
    return blockUser(
      { userId: actor.userId, target: body.userId },
      await getDb()
    )
  })
}
