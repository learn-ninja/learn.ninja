import { Redis } from "@upstash/redis"

import type { SecondaryStorage } from "@better-auth/core/db"

// Better Auth's secondary storage: sessions and its rate-limit counters live in Upstash Redis when
// it's configured, so a session check never waits on Postgres. Without Redis, sessions stay in the
// session table.

/** Redis over Upstash's REST API, under the names Upstash or the Vercel Marketplace set, or null. */
export function authStorageFromEnv(
  env = process.env
): SecondaryStorage | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  if (!url || !token) return null
  // Better Auth stores JSON text and parses it itself, so the client must hand strings back as is.
  return redisStorage(new Redis({ url, token, automaticDeserialization: false }))
}

export function redisStorage(redis: Redis): SecondaryStorage {
  const prefix = "auth:"
  return {
    get: (key) => redis.get<string>(prefix + key),
    getAndDelete: (key) => redis.getdel<string>(prefix + key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(prefix + key, value, { ex: ttl })
      else await redis.set(prefix + key, value)
    },
    delete: async (key) => {
      await redis.del(prefix + key)
    },
    increment: async (key, ttl) => {
      const n = await redis.incr(prefix + key)
      if (n === 1) await redis.expire(prefix + key, ttl)
      return n
    },
  }
}
