import { eq } from "drizzle-orm"

import { lesson, lessonTag, type Db } from "@workspace/db"
import {
  canUpgrade,
  normalizeTag,
  SPEC_VERSION,
  TAG_LIMITS,
  TAG_PATTERN,
  upgradeLesson,
  type Lesson,
} from "@workspace/spec"

// A one-off for lessons published before the tag table existed (`npm run tags:backfill -w web`):
// brings every stored lesson's JSON up to the current spec, the way the lesson page does on read,
// and rebuilds its lesson_tag rows. Rewriting the JSON matters because Explore's subject index
// reads `lesson->>'subject'`, which older rows don't have. Safe to run again: it only writes what
// the current code would write on an update.

export interface BackfillChange {
  id: string
  title: string
  /** The spec the row had; the row now has SPEC_VERSION. */
  from: string
  subject: string
  tags: string[]
}

export interface BackfillSummary {
  /** Whether anything was written (false for a dry run). */
  written: boolean
  lessons: number
  /** Rows whose JSON was (or would be) rewritten to the current spec. */
  upgraded: BackfillChange[]
  /** Tag rows written (or that would be) across all lessons. */
  tagRows: number
  /** Listed and unlisted alike: lessons per subject after the backfill. */
  bySubject: Record<string, number>
}

/** The tags the store would write for a lesson: normalized, valid, unique, at most five. */
function tagsOf(data: Lesson): string[] {
  const out: string[] = []
  for (const raw of data.tags ?? []) {
    if (typeof raw !== "string") continue
    const tag = normalizeTag(raw)
    if (
      tag.length >= TAG_LIMITS.min &&
      tag.length <= TAG_LIMITS.max &&
      TAG_PATTERN.test(tag) &&
      !out.includes(tag)
    )
      out.push(tag)
    if (out.length === TAG_LIMITS.perLesson) break
  }
  return out
}

export async function backfillTags(
  db: Db,
  { write = false } = {}
): Promise<BackfillSummary> {
  const rows = await db
    .select({ id: lesson.id, spec: lesson.spec, lesson: lesson.lesson })
    .from(lesson)
  const summary: BackfillSummary = {
    written: write,
    lessons: rows.length,
    upgraded: [],
    tagRows: 0,
    bySubject: {},
  }
  for (const row of rows) {
    const stored = row.lesson as Lesson
    const data = (canUpgrade(stored) ? upgradeLesson(stored) : stored) as Lesson
    const tags = tagsOf(data)
    const subject = String(data.subject)
    summary.bySubject[subject] = (summary.bySubject[subject] ?? 0) + 1
    summary.tagRows += tags.length
    if (data !== stored || row.spec !== SPEC_VERSION) {
      summary.upgraded.push({
        id: row.id,
        title: data.title,
        from: row.spec,
        subject,
        tags,
      })
      if (write)
        await db
          .update(lesson)
          .set({ spec: SPEC_VERSION, lesson: { ...data, tags } })
          .where(eq(lesson.id, row.id))
    }
    if (write) {
      await db.delete(lessonTag).where(eq(lessonTag.lessonId, row.id))
      if (tags.length)
        await db
          .insert(lessonTag)
          .values(tags.map((tag) => ({ lessonId: row.id, tag })))
    }
  }
  return summary
}

/** The summary as text for a terminal. */
export function formatBackfill(s: BackfillSummary): string {
  const verb = s.written ? "" : " (dry run: nothing written; add --write)"
  const lines = [
    `${s.lessons} lessons, ${s.upgraded.length} rewritten to spec ${SPEC_VERSION}, ${s.tagRows} tag rows${verb}`,
  ]
  for (const u of s.upgraded)
    lines.push(
      `  ${u.id}  ${u.from} → ${SPEC_VERSION}  ${u.subject.padEnd(11)}  ${u.title}${u.tags.length ? `  [${u.tags.join(", ")}]` : ""}`
    )
  lines.push("", "Lessons per subject")
  for (const [subject, n] of Object.entries(s.bySubject).sort(
    (a, b) => b[1] - a[1]
  ))
    lines.push(`  ${subject.padEnd(11)}  ${String(n).padStart(5)}`)
  return lines.join("\n")
}
