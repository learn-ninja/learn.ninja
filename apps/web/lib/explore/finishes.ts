// Lessons finished while logged out, kept in the browser until it's logged in: then each is sent
// to POST /api/lessons/{id}/complete with when it happened, so it counts on the learner's profile
// (the check, the activity grid) as if they'd been logged in. One entry per lesson, keyed by its id.

const PREFIX = "learn:finished:"
/** As long as a lesson lives; the server takes no older finish either. */
const KEEP_MS = 7 * 24 * 3.6e6

/** The browser's localStorage, or null where it's blocked: reading the global throws then. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Keep a logged-out finish of lesson `id`; a later finish of the same lesson replaces it. */
export function keepFinish(
  id: string,
  at = Date.now(),
  storage = browserStorage()
) {
  try {
    storage?.setItem(PREFIX + id, JSON.stringify({ at }))
  } catch {
    // Not kept (blocked or full); the lesson was still finished.
  }
}

/** The kept finishes, oldest first, dropping any over a week old or unreadable. */
export function keptFinishes(
  storage = browserStorage(),
  now = Date.now()
): { id: string; at: number }[] {
  if (!storage) return []
  const found: { id: string; at: number }[] = []
  const stale: string[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      let at: unknown
      try {
        at = (JSON.parse(storage.getItem(key) ?? "") as { at?: unknown }).at
      } catch {}
      if (typeof at === "number" && now - at <= KEEP_MS)
        found.push({ id: key.slice(PREFIX.length), at })
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
 * Send every kept finish, for a page that knows the browser is logged in. Each is forgotten once
 * the server has it (or the lesson is gone); one the server refused, or that never got there, waits
 * for the next page. Calls while a send is running share it.
 */
export function sendFinishes(
  storage = browserStorage(),
  post: typeof fetch = fetch
): Promise<void> {
  sending ??= send(storage, post).finally(() => {
    sending = null
  })
  return sending
}

async function send(storage: Storage | null, post: typeof fetch) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  for (const { id, at } of keptFinishes(storage)) {
    try {
      const res = await post(`/api/lessons/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tz, at }),
      })
      // Not logged in after all: they all wait. Rate-limited or a server error: this one waits.
      // Anything else (sent, or the lesson is gone) is done with.
      if (res.status === 401) return
      if (res.status !== 429 && res.status < 500)
        storage?.removeItem(PREFIX + id)
    } catch {
      return
    }
  }
}
