import { expireLessons, isCronRequest } from "@/lib/publish/handlers"
import { respond } from "@/lib/publish/respond"
import { getLessonStore } from "@/lib/publish/store"

// GET /api/cron/expire: deletes expired lessons. Vercel Cron calls it daily (vercel.json) with
// `Authorization: Bearer {CRON_SECRET}`; lesson pages already treat expired rows as gone, so this
// only frees space.

export async function GET(req: Request) {
  if (!isCronRequest(req.headers.get("authorization"))) {
    return Response.json(
      { ok: false, error: "unauthorized", message: "Not allowed." },
      { status: 401 }
    )
  }
  return respond(async () => expireLessons({ store: await getLessonStore() }))
}
