import { after } from "next/server"

import { getPlayCounter } from "@/lib/explore/cache"
import { recordPlay } from "@/lib/explore/handlers"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { idFromParam } from "@/lib/publish/ids"
import { clientKey } from "@/lib/publish/request"

// POST /api/lessons/{id}/play: the lesson page's beacon, sent once per browser per lesson per day
// (components/explore/play-beacon.tsx). The play is counted after this reply goes out, so the page
// never waits on it. Nothing to read back, so the reply is empty.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = idFromParam((await params).id)
  if (!id) return new Response(null, { status: 404 })
  if (!(await getRateLimiter("play").allow(clientKey(req))))
    return new Response(null, { status: 429 })
  after(async () => {
    try {
      await recordPlay(id, { plays: await getPlayCounter() })
    } catch (e) {
      console.error("Counting a play failed:", e)
    }
  })
  return new Response(null, { status: 202 })
}
