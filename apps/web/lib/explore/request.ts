import { getRateLimiter } from "@/lib/publish/rate-limit"
import { getDb } from "@/lib/publish/store"

import { getViewCounter, revalidateExplore } from "./cache"
import type { ExploreDeps } from "./handlers"
import { reportSenderFromEnv } from "./report-email"

/** What the like, report, view, and visibility routes need. */
export async function exploreDepsFor(req: Request): Promise<ExploreDeps> {
  const origin = process.env.LEARN_PUBLIC_URL ?? new URL(req.url).origin
  return {
    db: await getDb(),
    views: await getViewCounter(),
    limiter: getRateLimiter("report"),
    sendReport: reportSenderFromEnv(),
    origin,
    onChange: revalidateExplore,
  }
}
