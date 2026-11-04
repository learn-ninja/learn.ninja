import type { Prepared } from "@workspace/player-core/prepared"
import { prepareLesson } from "@workspace/player/prepare"
import type { Lesson } from "@workspace/spec"

import { getLesson } from "./lessons"

// The bundled test lessons, prepared once per server: their page at /lessons/{slug} and
// GET /api/lessons/{slug} share it. Kept apart from lessons.ts so the files that only need a
// lesson's text don't load the preparer (Shiki, KaTeX, D2, Tailwind).

const prepared = new Map<
  string,
  Promise<{ lesson: Lesson; prepared: Prepared }>
>()

/** A bundled lesson and what was prepared for it, or null when there's none by that slug. */
export function preparedBundled(
  slug: string
): Promise<{ lesson: Lesson; prepared: Prepared }> | null {
  const cached = prepared.get(slug)
  if (cached) return cached
  const lesson = getLesson(slug)
  if (!lesson) return null
  const promise = prepareLesson(lesson).then((p) => ({ lesson, prepared: p }))
  prepared.set(slug, promise)
  // A failed preparation (a cold start that couldn't load Shiki, say) isn't kept: the next
  // request tries again instead of getting the same error for the life of the server.
  promise.catch(() => {
    if (prepared.get(slug) === promise) prepared.delete(slug)
  })
  return promise
}
