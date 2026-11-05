import { exploreFeed } from "@/lib/explore/app-api"
import { getViewCounter } from "@/lib/explore/cache"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { actorFor, clientKey } from "@/lib/publish/request"
import { respond } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// GET /api/explore[?cursor=…]: the Explore feed as JSON for the iOS app, a page at a time
// (lib/explore/app-api.ts). Anyone may read it, as anyone may open /explore; a session cookie
// adds what the viewer liked and finished.

export async function GET(req: Request) {
  return respond(async () =>
    exploreFeed(
      {
        actor: await actorFor(req),
        cursor: new URL(req.url).searchParams.get("cursor"),
        client: clientKey(req),
      },
      {
        db: await getDb(),
        views: await getViewCounter(),
        limiter: getRateLimiter("read"),
      }
    )
  )
}
