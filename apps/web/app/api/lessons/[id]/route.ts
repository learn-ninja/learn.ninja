import { updateLesson } from "@/lib/publish/handlers"
import { clientKey, depsFor } from "@/lib/publish/request"
import { respond } from "@/lib/publish/respond"

// PUT /api/lessons/{id}: replace a published lesson, keeping its link and expiry.
// Needs the edit token from publishing: Authorization: Bearer <token>

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
