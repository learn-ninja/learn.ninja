import {
  deleteLesson,
  renameLesson,
  setVisibility,
} from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { updateLesson } from "@/lib/publish/handlers"
import { actorFor, clientKey, depsFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"

// PUT /api/lessons/{id}: replace a published lesson, keeping its link and expiry.
// Needs the edit token from publishing (Authorization: Bearer <token>), or the owner's session or
// x-api-key, so a lesson in your account updates from any folder or machine.
// PATCH /api/lessons/{id}: change who sees it, { "visibility": "public" | "unlisted" }, or rename
// it, { "title": "..." }. Owner only.
// DELETE /api/lessons/{id}: delete it for good. Owner only.

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const auth = req.headers.get("authorization")
  return respond(async () =>
    updateLesson(
      {
        id: (await params).id,
        editToken: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
        actorId: (await actorFor(req))?.userId ?? null,
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
      title?: unknown
    }
    if (body.title !== undefined && body.visibility === undefined) {
      return renameLesson(
        { id: (await params).id, userId: actor.userId, title: body.title },
        await exploreDepsFor(req)
      )
    }
    return setVisibility(
      {
        id: (await params).id,
        userId: actor.userId,
        visibility: body.visibility,
      },
      await exploreDepsFor(req)
    )
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return deleteLesson(
      { id: (await params).id, userId: actor.userId },
      await exploreDepsFor(req)
    )
  })
}
