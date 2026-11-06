import { profileFeed } from "@/lib/explore/app-api"
import { getViewCounter } from "@/lib/explore/cache"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { actorFor, clientKey } from "@/lib/publish/request"
import { respond } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// GET /api/profiles/{handle}?tz=…: a profile as JSON for the iOS app (lib/explore/app-api.ts),
// with the same visibility as /u/{handle}. `tz` is the viewer's time zone, so the activity grid
// ends on their today.

type Params = { params: Promise<{ handle: string }> }

export async function GET(req: Request, { params }: Params) {
  return respond(async () =>
    profileFeed(
      {
        handle: (await params).handle,
        actor: await actorFor(req),
        tz: new URL(req.url).searchParams.get("tz"),
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
