import { getViewCounter } from "@/lib/explore/cache"
import { PostgresDraftStore } from "@/lib/mcp/drafts"
import { flushPendingViews } from "@/lib/explore/handlers"
import { expireLessons, isCronRequest } from "@/lib/publish/claims"
import { respond } from "@/lib/publish/respond"
import { getDb, getLessonStore } from "@/lib/publish/store"

// GET /api/cron/expire: deletes expired lessons and MCP drafts, and adds the views still pending in Redis to the
// lesson table. Vercel Cron calls it daily (vercel.json) with `Authorization: Bearer {CRON_SECRET}`;
// lesson pages already treat expired rows as gone, and the Explore lists flush views themselves
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
    const views = await flushPendingViews({
      db: await getDb(),
      views: await getViewCounter(),
    })
    const drafts = await new PostgresDraftStore(await getDb()).deleteExpired()
    return { ...reply, body: { ...reply.body, views, drafts } }
  })
}
