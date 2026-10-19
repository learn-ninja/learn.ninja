import { deleteKey } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// DELETE /api/keys/{id}: revoke a key. A key may revoke itself (`learn logout`); the website
// revokes any of the account's keys.

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return deleteKey(await getAuth(), req.headers, (await params).id)
  })
}
