import { after } from "next/server"

import { getViewCounter } from "@/lib/explore/cache"
import { recordView } from "@/lib/explore/handlers"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { idFromParam } from "@/lib/publish/ids"
import { clientKey } from "@/lib/publish/request"

// POST /api/lessons/{id}/view: the lesson page's beacon, sent each time the page opens
// (components/explore/view-beacon.tsx). The view is counted after this reply goes out, so the page
// never waits on it. Nothing to read back, so the reply is empty.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = idFromParam((await params).id)
  if (!id) return new Response(null, { status: 404 })
  if (!(await getRateLimiter("view").allow(clientKey(req))))
    return new Response(null, { status: 429 })
  after(async () => {
    try {
      await recordView(id, { views: await getViewCounter() })
    } catch (e) {
      console.error("Counting a view failed:", e)
    }
  })
  return new Response(null, { status: 202 })
}
