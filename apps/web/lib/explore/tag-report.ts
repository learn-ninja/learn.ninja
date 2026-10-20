import { eq, sql } from "drizzle-orm"

import { lesson, lessonTag, type Db } from "@workspace/db"
import {
  isSubject,
  SUBJECT_INFO,
  SUBJECTS,
  subjectForTopic,
  type Subject,
} from "@workspace/spec"

import { listed } from "./queries"

// The weekly tag report (`npm run tags -w web`): subjects by lesson count, the top tags in each,
// and the tags used only once. It's the whole moderation process for tags until the numbers ask
// for more: a person reads it, adds synonyms to packages/spec/src/tags.ts, notices a subject that
// is swallowing everything, and decides when a tag has earned a filter (plans/subjects-and-tags.md).

export interface TagCount {
  /** The key the lessons share. */
  tag: string
  /** How the key is most often written on those lessons (ties by name); what a filter chip would say. */
  label: string
  lessons: number
}

export interface SubjectReport {
  subject: Subject
  lessons: number
  /** The subject's most used tags, most used first; ties by name. */
  tags: TagCount[]
}

export interface TagReport {
  /** Listed lessons: what Explore shows, which is what filters will apply to. */
  lessons: number
  /** Every subject, most lessons first; ties in the list's order. */
  subjects: SubjectReport[]
  /** Tags on exactly one lesson, with that lesson's subject: the raw material for synonyms. */
  singles: { tag: string; label: string; subject: Subject }[]
}

/** Counts listed lessons and their tags. `top` caps the tags shown per subject. */
export async function tagReport(
  db: Db,
  { now = Date.now(), top = 50 } = {}
): Promise<TagReport> {
  const field = (name: string) => sql<string | null>`${lesson.lesson}->>${name}`
  const lessons = await db
    .select({ id: lesson.id, subject: field("subject"), topic: field("topic") })
    .from(lesson)
    .where(listed(now))
  // Lessons from before spec 0.6 carry a topic label instead of a subject; map it as Explore does.
  const subjectOf = new Map<string, Subject>()
  for (const row of lessons)
    subjectOf.set(
      row.id,
      isSubject(row.subject) ? row.subject : subjectForTopic(row.topic)
    )

  const tagged = await db
    .select({
      lessonId: lessonTag.lessonId,
      tag: lessonTag.tag,
      label: lessonTag.label,
    })
    .from(lessonTag)
    .innerJoin(lesson, eq(lesson.id, lessonTag.lessonId))
    .where(listed(now))

  const perSubject = new Map<Subject, Map<string, number>>(
    SUBJECTS.map((s) => [s, new Map()])
  )
  const lessonsPerSubject = new Map<Subject, number>(
    SUBJECTS.map((s) => [s, 0])
  )
  for (const subject of subjectOf.values())
    lessonsPerSubject.set(subject, lessonsPerSubject.get(subject)! + 1)
  const overall = new Map<string, { count: number; subject: Subject }>()
  // How often each key is written each way, across all listed lessons.
  const spellings = new Map<string, Map<string, number>>()
  for (const { lessonId, tag, label } of tagged) {
    const subject = subjectOf.get(lessonId)!
    const counts = perSubject.get(subject)!
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
    const seen = overall.get(tag)
    overall.set(tag, { count: (seen?.count ?? 0) + 1, subject })
    const written = spellings.get(tag) ?? new Map<string, number>()
    written.set(label, (written.get(label) ?? 0) + 1)
    spellings.set(tag, written)
  }
  /** The most common label for a key; ties by name with capitals first, so the report is stable. */
  const labelOf = (tag: string) =>
    [...(spellings.get(tag) ?? [])].sort(
      (a, b) =>
        b[1] - a[1] || a[0].localeCompare(b[0], "en", { caseFirst: "upper" })
    )[0]?.[0] ?? tag

  const byCount = (a: TagCount, b: TagCount) =>
    b.lessons - a.lessons || a.tag.localeCompare(b.tag)
  const subjects = SUBJECTS.map((subject) => ({
    subject,
    lessons: lessonsPerSubject.get(subject)!,
    tags: [...perSubject.get(subject)!]
      .map(([tag, lessons]) => ({ tag, label: labelOf(tag), lessons }))
      .sort(byCount)
      .slice(0, top),
  })).sort(
    (a, b) =>
      b.lessons - a.lessons ||
      SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject)
  )
  const singles = [...overall]
    .filter(([, { count }]) => count === 1)
    .map(([tag, { subject }]) => ({ tag, label: labelOf(tag), subject }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
  return { lessons: lessons.length, subjects, singles }
}

/** The report as text for a terminal. */
export function formatTagReport(report: TagReport, at = new Date()): string {
  const lines: string[] = [
    `Tag report, ${at.toISOString().slice(0, 10)}: ${report.lessons} listed ${plural(report.lessons, "lesson")}`,
    "",
    "Subjects",
  ]
  const width = Math.max(...SUBJECTS.map((s) => s.length))
  for (const { subject, lessons } of report.subjects)
    lines.push(
      `  ${subject.padEnd(width)}  ${String(lessons).padStart(5)}  ${SUBJECT_INFO[subject].name}`
    )
  lines.push("", "Top tags by subject (the key's most common label, then its lesson count)")
  for (const { subject, lessons, tags } of report.subjects) {
    if (!lessons) continue
    lines.push(`  ${subject} (${lessons})`)
    lines.push(
      tags.length
        ? `    ${tags.map((t) => `${shown(t)} ${t.lessons}`).join(", ")}`
        : "    no tags"
    )
  }
  lines.push(
    "",
    `Tags used once (${report.singles.length}): candidates for the synonym table`
  )
  if (report.singles.length)
    lines.push(
      `  ${report.singles.map((s) => `${shown(s)} (${s.subject})`).join(", ")}`
    )
  else lines.push("  none")
  return lines.join("\n")
}

/**
 * A tag as the report prints it: its label, with the key in brackets when that isn't just the
 * label's spelling ("JS [javascript]": a synonym at work, or a label from before the backfill).
 */
function shown({ tag, label }: { tag: string; label: string }): string {
  const plain = label.toLowerCase().replace(/\s+/g, "-")
  return plain === tag ? label : `${label} [${tag}]`
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`)
