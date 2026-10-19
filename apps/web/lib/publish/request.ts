import type { Deps } from "./handlers"
import { getRateLimiter } from "./rate-limit"
import { getLessonStore } from "./store"

/** The client's IP for rate limits (Vercel sets x-forwarded-for). */
export function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  )
}

export async function depsFor(req: Request): Promise<Deps> {
  const origin = process.env.LEARN_PUBLIC_URL ?? new URL(req.url).origin
  return { store: await getLessonStore(), limiter: getRateLimiter(), origin }
}
