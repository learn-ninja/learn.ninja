import { connectMcp, disconnectMcp } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// POST /api/account/mcp: make (or replace) the account's personal MCP URL, returned once in the
// clear. DELETE /api/account/mcp: revoke it. Both need a browser session, not a key.

export async function POST(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor || actor.viaApiKey) return SIGN_IN_REQUIRED
    const origin = process.env.LEARN_PUBLIC_URL ?? new URL(req.url).origin
    return connectMcp(await getAuth(), req.headers, actor.userId, origin)
  })
}

export async function DELETE(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor || actor.viaApiKey) return SIGN_IN_REQUIRED
    return disconnectMcp(await getAuth(), req.headers)
  })
}
