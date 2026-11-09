import { Storage } from "expo-sqlite/kv-store"

// The lesson last left unfinished, kept on the device: the app icon's Continue (quick-actions.ts),
// the medium widget's (widget.ts), and where a streak reminder opens (reminders.ts). Written while a
// lesson is on screen and removed once it's finished or gone, by quick-actions.ts.

export interface LastLesson {
  /** The app's route for it, /l/{slugId}. */
  href: string
  title: string
}

/** Where it's kept in the kv-store. */
export const LAST = "learn:last-lesson"

/** The lesson last left unfinished, if any: Continue's, and where a streak reminder opens. */
export function readLast(): LastLesson | null {
  try {
    const raw = Storage.getItemSync(LAST)
    const last: unknown = raw ? JSON.parse(raw) : null
    return last &&
      typeof last === "object" &&
      "href" in last &&
      "title" in last &&
      typeof last.href === "string" &&
      typeof last.title === "string"
      ? { href: last.href, title: last.title }
      : null
  } catch {
    return null
  }
}
