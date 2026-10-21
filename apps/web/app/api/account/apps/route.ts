import { connectedApps } from "@/lib/auth/account"
import { getDb } from "@/lib/publish/store"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// GET /api/account/apps: the chat apps that logged in over OAuth and the user allowed, for the
// settings page. Needs a browser session, not a key.

export async function GET(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor || actor.viaApiKey) return SIGN_IN_REQUIRED
    const apps = await connectedApps(await getDb(), actor.userId)
    return { status: 200, body: { ok: true, apps } }
  })
}
