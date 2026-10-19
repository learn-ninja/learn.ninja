import { getPlayCounter } from "@/lib/explore/cache"
import { flushPendingPlays } from "@/lib/explore/handlers"
import { expireLessons, isCronRequest } from "@/lib/publish/handlers"
import { respond } from "@/lib/publish/respond"
import { getDb, getLessonStore } from "@/lib/publish/store"

// GET /api/cron/expire: deletes expired lessons and adds the plays still pending in Redis to the
// lesson table. Vercel Cron calls it daily (vercel.json) with `Authorization: Bearer {CRON_SECRET}`;
// lesson pages already treat expired rows as gone, and the Explore lists flush plays themselves
// when they refresh, so this only frees space and catches up.

export async function GET(req: Request) {
  if (!isCronRequest(req.headers.get("authorization"))) {
    return Response.json(
      { ok: false, error: "unauthorized", message: "Not allowed." },
      { status: 401 }
    )
  }
  return respond(async () => {
    const reply = await expireLessons({ store: await getLessonStore() })
    const plays = await flushPendingPlays({
      db: await getDb(),
      plays: await getPlayCounter(),
    })
    return { ...reply, body: { ...reply.body, plays } }
  })
}
