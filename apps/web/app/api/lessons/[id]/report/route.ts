import { reportLesson } from "@/lib/explore/handlers"
import { exploreDepsFor } from "@/lib/explore/request"
import { clientKey } from "@/lib/publish/request"
import { respond } from "@/lib/publish/respond"

// POST /api/lessons/{id}/report with { "reason": "…" }: anyone can report a lesson; the maker gets
// an email. Rate-limited per client.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(async () => {
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown }
    return reportLesson(
      { id: (await params).id, reason: body.reason, client: clientKey(req) },
      await exploreDepsFor(req)
    )
  })
}
