/**
 * Picks `count` lessons from a newest-first list so no subject takes more than `perSubject` of
 * them: a run of lessons on one subject (someone publishing a ten-lesson path) can't make the
 * home page look like it's about that subject alone. Keeps the list's order, and tops up with
 * the lessons it skipped when there aren't enough subjects to fill the row.
 */
export function mixSubjects<T extends { subject: string }>(
  lessons: T[],
  count: number,
  perSubject = 2
): T[] {
  const taken = new Map<string, number>()
  const picked = new Set<T>()
  for (const lesson of lessons) {
    if (picked.size === count) break
    const n = taken.get(lesson.subject) ?? 0
    if (n >= perSubject) continue
    taken.set(lesson.subject, n + 1)
    picked.add(lesson)
  }
  for (const lesson of lessons) {
    if (picked.size === count) break
    picked.add(lesson)
  }
  return lessons.filter((lesson) => picked.has(lesson))
}
