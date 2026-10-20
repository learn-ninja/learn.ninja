import { checkLesson, type Issue } from "./rules"
import { lesson as lessonSchema, type Lesson } from "./schema"
import { normalizeLessonTags } from "./tags"

/** Something the checker changed or wants known that doesn't stop the lesson: a normalized tag, say. */
export interface Note {
  path: string
  message: string
}

export type ValidationResult =
  | { ok: true; lesson: Lesson; issues: []; notes: Note[] }
  | { ok: false; issues: Issue[]; notes: Note[] }

/**
 * Check a lesson file (as JSON text or an already-parsed value) against the current spec and the v1 rules.
 * Tag labels are tidied first (trimmed, whitespace collapsed, a leading # gone; the lesson returned
 * carries the tidied ones, with a note for each change); then the schema; the cross-field rules run
 * only on a lesson that matches it.
 */
export function validateLesson(input: string | unknown): ValidationResult {
  let raw: string
  let data: unknown
  if (typeof input === "string") {
    raw = input
    try {
      data = JSON.parse(input)
    } catch (e) {
      return {
        ok: false,
        issues: [
          {
            kind: "structure",
            path: "",
            message: `The file isn't valid JSON: ${(e as Error).message}`,
          },
        ],
        notes: [],
      }
    }
  } else {
    data = input
    raw = JSON.stringify(input)
  }

  const normalized = normalizeLessonTags(data)
  const notes: Note[] = normalized.changes.map((c) => ({
    path: c.path,
    message: `Kept the tag "${c.from}" as "${c.to}".`,
  }))

  const parsed = lessonSchema.safeParse(normalized.data)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        kind: "structure",
        path: formatPath(i.path),
        message: i.message,
      })),
      notes,
    }
  }

  const issues = checkLesson(parsed.data, raw)
  return issues.length
    ? { ok: false, issues, notes }
    : { ok: true, lesson: parsed.data, issues: [], notes }
}

/** ["bricks", 2, "options", 1] → "bricks[2].options[1]" */
export function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (out, key) =>
      typeof key === "number"
        ? `${out}[${key}]`
        : out
          ? `${out}.${String(key)}`
          : String(key),
    ""
  )
}

/** Issues (or notes) as one line each, ready to hand back to an LLM. */
export function formatIssues(
  issues: { path: string; message: string }[]
): string {
  return issues.map((i) => `- ${i.path || "lesson"}: ${i.message}`).join("\n")
}
