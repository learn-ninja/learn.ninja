import { completeLesson } from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// POST /api/lessons/{id}/complete records that the signed-in user (cookie or x-api-key) finished
// the lesson, sent by the lesson page when the wrap-up shows. Only the first time is kept.

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return completeLesson(
      { id: (await params).id, userId: actor.userId },
      await exploreDepsFor(req)
    )
  })
}
