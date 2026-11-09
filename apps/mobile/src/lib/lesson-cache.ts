import type { LoadedLesson } from "./api"

// The lessons last opened on this phone, kept whole (the lesson, its prepared formulas, code and
// drawings, its math SVG and the visuals' stylesheet) so one plays again with no connection. A
// lesson's visuals carry no remote URLs (the spec rejects them), so the copy is all it needs.
// Kept in expo-sqlite's kv-store, keyed by the link's own param ("{slug}-{id}", or a bundled
// lesson's slug), since that's all the lesson route knows before the server answers.

/** Each kept lesson, by the param it was opened with. */
export const LESSON_PREFIX = "learn:lesson:"
/** The kept lessons' list, most recently opened first. */
export const LESSONS_KEY = "learn:lessons"
/** How many lessons the phone keeps. */
export const KEEP = 20

/** A kept lesson as a list shows it, without loading the whole lesson. */
export interface CachedEntry {
  /** The lesson route's param: open it at /l/{param}. */
  param: string
  title: string
  /** The lesson's language, so its title runs its own way in a list. */
  language: string
  /** When it was last opened (ms since epoch). */
  savedAt: number
  /** When its link stops working (ms since epoch); null for a kept or bundled lesson. */
  expiresAt: number | null
}

/** What the cache is kept in: expo-sqlite's kv-store, or a map in tests. */
export interface CacheStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const expired = (entry: { expiresAt: number | null }, now: number) =>
  entry.expiresAt !== null && entry.expiresAt <= now

function readList(storage: CacheStorage): CachedEntry[] {
  try {
    const list: unknown = JSON.parse(storage.getItem(LESSONS_KEY) ?? "[]")
    return Array.isArray(list)
      ? list.filter(
          (e): e is CachedEntry =>
            typeof e === "object" &&
            e !== null &&
            typeof (e as CachedEntry).param === "string" &&
            typeof (e as CachedEntry).title === "string"
        )
      : []
  } catch {
    return []
  }
}

/** Writes the list, removing the lessons that fell off it. */
function writeList(
  storage: CacheStorage,
  list: CachedEntry[],
  dropped: CachedEntry[]
) {
  for (const e of dropped) storage.removeItem(LESSON_PREFIX + e.param)
  storage.setItem(LESSONS_KEY, JSON.stringify(list))
}

/** Splits the list into what stays (fresh, the newest KEEP) and what goes. */
function prune(list: CachedEntry[], now: number) {
  const fresh = list.filter((e) => !expired(e, now))
  const keep = fresh.slice(0, KEEP)
  const drop = list.filter((e) => !keep.includes(e))
  return { keep, drop }
}

/**
 * Keeps a lesson that just loaded, as the most recently opened. A lesson already past its expiry
 * isn't kept. Storage failing (a full disk) only means no copy: the lesson still plays.
 */
export function cacheLesson(
  storage: CacheStorage,
  param: string,
  data: LoadedLesson,
  now = Date.now()
) {
  if (expired(data, now)) return forgetCachedLesson(storage, param)
  try {
    const rest = readList(storage).filter((e) => e.param !== param)
    const entry: CachedEntry = {
      param,
      title: data.lesson.title,
      language: data.lesson.language,
      savedAt: now,
      expiresAt: data.expiresAt,
    }
    const copy: LoadedLesson = { ...data, offline: undefined }
    storage.setItem(LESSON_PREFIX + param, JSON.stringify(copy))
    const { keep, drop } = prune([entry, ...rest], now)
    writeList(storage, keep, drop)
  } catch {}
}

/** The kept copy of a lesson, marked offline; null when there's none or it has expired. */
export function cachedLesson(
  storage: CacheStorage,
  param: string,
  now = Date.now()
): LoadedLesson | null {
  try {
    const entry = readList(storage).find((e) => e.param === param)
    if (!entry || expired(entry, now)) return null
    const raw = storage.getItem(LESSON_PREFIX + param)
    if (!raw) return null
    const data = JSON.parse(raw) as LoadedLesson
    if (!data?.lesson || expired(data, now)) return null
    return { ...data, offline: true }
  } catch {
    return null
  }
}

/** Forgets a lesson the server says is gone (expired, deleted, hidden). */
export function forgetCachedLesson(storage: CacheStorage, param: string) {
  try {
    const list = readList(storage)
    storage.removeItem(LESSON_PREFIX + param)
    storage.setItem(
      LESSONS_KEY,
      JSON.stringify(list.filter((e) => e.param !== param))
    )
  } catch {}
}

/** The kept lessons that still open, most recently opened first; expired ones are dropped. */
export function cachedLessons(
  storage: CacheStorage,
  now = Date.now()
): CachedEntry[] {
  try {
    const list = readList(storage)
    const { keep, drop } = prune(list, now)
    if (drop.length) writeList(storage, keep, drop)
    return keep
  } catch {
    return []
  }
}
