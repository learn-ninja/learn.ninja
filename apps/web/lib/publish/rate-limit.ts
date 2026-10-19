import { Ratelimit } from "@upstash/ratelimit"

import { redisFromEnv } from "./store"

// Basic abuse protection for anonymous publishing: a limit per IP address.
// Placeholder numbers until real usage shows what's right (open question in the planning doc).

export const PUBLISH_LIMIT = { requests: 20, windowSeconds: 60 * 60 }
/** Checks are cheap and agents re-check after every fix, so this one is looser. */
export const VALIDATE_LIMIT = { requests: 120, windowSeconds: 60 * 60 }
/** Sign-in codes per email address: each one is an email we pay for. Better Auth limits per IP on top. */
export const CODE_LIMIT = { requests: 5, windowSeconds: 60 * 60 }

const LIMITS = {
  publish: PUBLISH_LIMIT,
  validate: VALIDATE_LIMIT,
  code: CODE_LIMIT,
}
export type LimitName = keyof typeof LIMITS

export interface RateLimiter {
  /** Whether this key may make another request now. */
  allow(key: string): Promise<boolean>
}

/** In-memory fallback for development: resets when the server restarts. */
export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(
    private limit = PUBLISH_LIMIT.requests,
    private windowMs = PUBLISH_LIMIT.windowSeconds * 1000
  ) {}
  async allow(key: string) {
    const now = Date.now()
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs
    )
    if (recent.length >= this.limit) return false
    this.hits.set(key, [...recent, now])
    return true
  }
}

const limiters = new Map<LimitName, RateLimiter>()

export function getRateLimiter(name: LimitName = "publish"): RateLimiter {
  const existing = limiters.get(name)
  if (existing) return existing
  const limiter = makeRateLimiter(name)
  limiters.set(name, limiter)
  return limiter
}

function makeRateLimiter(name: LimitName): RateLimiter {
  const { requests, windowSeconds } = LIMITS[name]
  const redis = redisFromEnv()
  if (!redis) return new MemoryRateLimiter(requests, windowSeconds * 1000)
  const upstash = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    prefix: `ratelimit:${name}`,
  })
  return { allow: async (key) => (await upstash.limit(key)).success }
}
