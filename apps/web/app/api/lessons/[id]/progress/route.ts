import { recordProgress } from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// PUT /api/lessons/{id}/progress with { done, total } records how far the logged-in user (cookie or
// x-api-key) got in the lesson, sent by the lesson page as they move past each kata. Their
// profile's In progress tab lists these until the lesson is finished.

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body: unknown = await req.json().catch(() => null)
    const sent = body && typeof body === "object" ? body : {}
    return recordProgress(
      {
        id: (await params).id,
        userId: actor.userId,
        done: "done" in sent ? sent.done : undefined,
        total: "total" in sent ? sent.total : undefined,
      },
      await exploreDepsFor(req)
    )
  })
}
