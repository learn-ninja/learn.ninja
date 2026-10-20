import { publishLesson } from "@/lib/publish/handlers"
import { actorFor, clientKey, depsFor } from "@/lib/publish/request"
import { respond } from "@/lib/publish/respond"

// POST /api/lessons: publish a lesson file. Returns its link and a secret edit token. Anonymous
// lessons also get a claim token and last 7 days; with a session cookie or x-api-key, the lesson
// belongs to that account and never expires.

export async function POST(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    return publishLesson(
      {
        text: await req.text(),
        client: clientKey(req),
        skillVersion: req.headers.get("x-learn-skill-version"),
        ownerId: actor?.userId ?? null,
        ownerHandle: actor?.handle ?? null,
      },
      await depsFor(req)
    )
  })
}
