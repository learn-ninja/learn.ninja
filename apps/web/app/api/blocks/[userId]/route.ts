import { unblockUser } from "@/lib/explore/blocks"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// DELETE /api/blocks/{userId}: the logged-in user unblocks someone (lib/explore/blocks.ts).

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return unblockUser(
      { userId: actor.userId, target: (await params).userId },
      await getDb()
    )
  })
}
