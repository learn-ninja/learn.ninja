import { withCharts } from "@workspace/player/charts"

import { preparedBundled } from "@/lib/bundled-lessons"
import {
  deleteLesson,
  renameLesson,
  setVisibility,
} from "@/lib/explore/handlers"
import { authorOf } from "@/lib/explore/queries"
import { exploreDepsFor } from "@/lib/explore/request"
import { updateLesson } from "@/lib/publish/handlers"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { drawLessonMath } from "@/lib/publish/math-svg"
import { readLesson } from "@/lib/publish/read"
import { actorFor, clientKey, depsFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"
import { getDb, getLessonStore } from "@/lib/publish/store"

// GET /api/lessons/{id}: the lesson and its prepared output as JSON, for the app (lib/publish/read.ts).
// {id} is a lesson id, its "{slug}-{id}" link segment, or a bundled test lesson's slug.
// PUT /api/lessons/{id}: replace a published lesson, keeping its link and expiry.
// Needs the edit token from publishing (Authorization: Bearer <token>), or the owner's session or
// x-api-key, so a lesson in your account updates from any folder or machine.
// PATCH /api/lessons/{id}: change who sees it, { "visibility": "public" | "unlisted" }, or rename
// it, { "title": "..." }. Owner only.
// DELETE /api/lessons/{id}: delete it for good. Owner only.

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const param = (await params).id
  return respond(async () =>
    readLesson(
      { param, client: clientKey(req) },
      {
        store: await getLessonStore(),
        limiter: getRateLimiter("read"),
        withCharts,
        drawMath: drawLessonMath,
        visualsCssUrl:
          process.env.NEXT_PUBLIC_VISUALS_CSS ?? "/lesson-visuals.css",
        bundled: async (slug) => preparedBundled(slug),
        handleOf: async (ownerId) =>
          (await authorOf(await getDb(), ownerId))?.handle ?? null,
      }
    )
  )
}

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
