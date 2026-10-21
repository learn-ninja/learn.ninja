import { disconnectApp } from "@/lib/auth/account"
import { getDb } from "@/lib/publish/store"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// DELETE /api/account/apps/{id}: disconnect a chat app that logged in over OAuth; {id} is the
// one GET /api/account/apps lists. Its tokens stop working at once. Needs a browser session.

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor || actor.viaApiKey) return SIGN_IN_REQUIRED
    return disconnectApp(await getDb(), actor.userId, (await params).id)
  })
}
