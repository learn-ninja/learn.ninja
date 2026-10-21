import { likeLesson, unlikeLesson } from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// POST /api/lessons/{id}/like likes a lesson for the logged-in user (cookie or x-api-key); DELETE
// takes the like back. One like per user per lesson: repeating either changes nothing.

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return likeLesson(
      { id: (await params).id, userId: actor.userId },
      await exploreDepsFor(req)
    )
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return unlikeLesson(
      { id: (await params).id, userId: actor.userId },
      await exploreDepsFor(req)
    )
  })
}
