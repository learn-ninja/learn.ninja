import { revalidateExplore } from "@/lib/explore/cache"
import { claimLesson } from "@/lib/publish/handlers"
import { actorFor, depsFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// POST /api/lessons/{id}/claim: move an anonymous lesson into the caller's account. The body is
// { "claimToken": "…" } or { "editToken": "…" } from publishing (either proves authorship); the
// caller signs in with a cookie or x-api-key.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as {
      claimToken?: unknown
      editToken?: unknown
    }
    const token = (value: unknown) =>
      typeof value === "string" && value ? value : null
    const claimToken = token(body.claimToken)
    const editToken = token(body.editToken)
    if (!claimToken && !editToken) {
      return {
        status: 400,
        body: {
          ok: false,
          error: "bad_request",
          message:
            'Send { "claimToken": "…" } or { "editToken": "…" } from publishing.',
        },
      }
    }
    const reply = await claimLesson(
      { id: (await params).id, claimToken, editToken, ownerId: actor.userId },
      await depsFor(req)
    )
    // A kept lesson is listed straight away.
    if (reply.status === 200) revalidateExplore()
    return reply
  })
}
