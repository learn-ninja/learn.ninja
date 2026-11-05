import { FINISHED_PREFIX } from "./streak"
import type { Send } from "./progress-sync"

// Lessons finished while logged out, kept on the device under the web's key and shape
// (`learn:finished:{id}` = { at }, apps/web/lib/explore/finishes.ts; streak.ts keeps them) until the
// app signs in: then each is sent to POST /api/lessons/{id}/complete with when it happened, so it
// counts on the learner's profile (the check, the activity grid, the streak) as if they'd been
// logged in. The same rules as the web's sendFinishes: the server takes no finish over a week old.

/** What the kept finishes are read from: expo-sqlite's kv-store, or a map in tests. */
export interface FinishStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  removeItem(key: string): void
}

/** As long as a lesson lives; the server takes no older finish either. */
const KEEP_MS = 7 * 24 * 3.6e6

/** The kept finishes, oldest first, dropping any over a week old or unreadable. */
export function keptFinishes(
  storage: FinishStorage,
  now = Date.now()
): { id: string; at: number }[] {
  const found: { id: string; at: number }[] = []
  const stale: string[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(FINISHED_PREFIX)) continue
      let at: unknown
      try {
        at = (JSON.parse(storage.getItem(key) ?? "") as { at?: unknown }).at
      } catch {}
      if (typeof at === "number" && now - at <= KEEP_MS)
        found.push({ id: key.slice(FINISHED_PREFIX.length), at })
      else stale.push(key)
    }
    for (const key of stale) storage.removeItem(key)
  } catch {
    return []
  }
  return found.sort((a, b) => a.at - b.at)
}

let sending: Promise<void> | null = null

/**
 * Sends every kept finish, once the app is signed in. Each is forgotten once the server has it (or
 * the lesson is gone); one the server refused, or that never got there, waits for the next sign-in
 * or launch. Calls while a send is running share it.
 */
export function sendFinishes(
  storage: FinishStorage,
  send: Send,
  tz = Intl.DateTimeFormat().resolvedOptions().timeZone
): Promise<void> {
  sending ??= sendAll(storage, send, tz).finally(() => {
    sending = null
  })
  return sending
}

async function sendAll(storage: FinishStorage, send: Send, tz: string) {
  for (const { id, at } of keptFinishes(storage)) {
    try {
      const res = await send(
        `/api/lessons/${encodeURIComponent(id)}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ tz, at }),
        }
      )
      // Not signed in after all: they all wait. Rate-limited or a server error: this one waits.
      // Anything else (sent, or the lesson is gone) is done with.
      if (res.status === 401) return
      if (res.status !== 429 && res.status < 500)
        storage.removeItem(FINISHED_PREFIX + id)
    } catch {
      return
    }
  }
}
