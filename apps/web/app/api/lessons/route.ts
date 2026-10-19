import { publishLesson } from "@/lib/publish/handlers"
import { clientKey, depsFor } from "@/lib/publish/request"
import { respond } from "@/lib/publish/respond"

// POST /api/lessons: publish a lesson file. Returns its link and a secret edit token.

export async function POST(req: Request) {
  return respond(async () =>
    publishLesson(
      {
        text: await req.text(),
        client: clientKey(req),
        skillVersion: req.headers.get("x-learn-skill-version"),
      },
      await depsFor(req)
    )
  )
}
