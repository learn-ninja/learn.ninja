import { viewerTimeZone } from "@/lib/activity/server"
import { completeLesson } from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// POST /api/lessons/{id}/complete records that the logged-in user (cookie or x-api-key) finished
// the lesson, sent by the lesson page when the wrap-up shows. Only the first time is kept. The
// body may carry the browser's time zone as { tz }, which decides the day the finish counts for
// on the profile; without it the tz cookie, then UTC.

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body: unknown = await req.json().catch(() => null)
    const sent =
      body && typeof body === "object" && "tz" in body ? body.tz : undefined
    const tz = typeof sent === "string" ? sent : await viewerTimeZone()
    return completeLesson(
      { id: (await params).id, userId: actor.userId, tz },
      await exploreDepsFor(req)
    )
  })
}
