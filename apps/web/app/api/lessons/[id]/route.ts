import { setVisibility } from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { updateLesson } from "@/lib/publish/handlers"
import { actorFor, clientKey, depsFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// PUT /api/lessons/{id}: replace a published lesson, keeping its link and expiry.
// Needs the edit token from publishing: Authorization: Bearer <token>
// PATCH /api/lessons/{id}: change who sees it, { "visibility": "public" | "unlisted" }. Owner only.

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const auth = req.headers.get("authorization")
  return respond(async () =>
    updateLesson(
      {
        id: (await params).id,
        editToken: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
        text: await req.text(),
        client: clientKey(req),
        skillVersion: req.headers.get("x-learn-skill-version"),
      },
      await depsFor(req)
    )
  )
}

export async function PATCH(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const body = (await req.json().catch(() => ({}))) as {
      visibility?: unknown
    }
    return setVisibility(
      { id: (await params).id, userId: actor.userId, visibility: body.visibility },
      await exploreDepsFor(req)
    )
  })
}
