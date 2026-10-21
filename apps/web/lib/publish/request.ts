import { getActor, type Actor } from "@/lib/auth/actor"
import { getAuth } from "@/lib/auth/auth"
import { handleOf } from "@/lib/auth/handles"

import type { Deps } from "./handlers"
import { getRateLimiter } from "./rate-limit"
import { getDb, getLessonStore } from "./store"

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
  const db = await getDb()
  return {
    store: await getLessonStore(),
    limiter: getRateLimiter(),
    origin,
    handleOf: (userId) => handleOf(db, userId),
  }
}

/** The logged-in user behind the request (cookie or x-api-key), or null. Throws InvalidApiKeyError for a bad key. */
export async function actorFor(req: Request): Promise<Actor | null> {
  return getActor(await getAuth(), req.headers)
}
