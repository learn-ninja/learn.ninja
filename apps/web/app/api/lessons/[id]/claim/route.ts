import { claimLesson } from "@/lib/publish/handlers"
import { actorFor, depsFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// POST /api/lessons/{id}/claim: move an anonymous lesson into the caller's account. The body is
// { "claimToken": "…" } from publishing; the caller signs in with a cookie or x-api-key.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as {
      claimToken?: unknown
    }
    if (typeof body.claimToken !== "string" || !body.claimToken) {
      return {
        status: 400,
        body: {
          ok: false,
          error: "bad_request",
          message: "Send { \"claimToken\": \"…\" } from publishing.",
        },
      }
    }
    return claimLesson(
      { id: (await params).id, claimToken: body.claimToken, ownerId: actor.userId },
      await depsFor(req)
    )
  })
}
