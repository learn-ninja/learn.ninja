import type { ConceptKata, Lesson, QuestionKata } from "@workspace/spec"

// The order a lesson plays in, and how the score is counted.

export type Role = "hook" | "practice" | "challenge" | "fix"

export type Item =
  | { kind: "intro" }
  | { kind: "concept"; kata: ConceptKata }
  | { kind: "question"; kata: QuestionKata; role: Role }
  | { kind: "fix" }
  | { kind: "wrap" }

/** Intro → hook → the lesson's katas → challenge → fix-your-mistakes slot → wrap-up. */
export function buildSequence(lesson: Lesson): Item[] {
  return [
    { kind: "intro" },
    { kind: "question", kata: lesson.hook, role: "hook" },
    ...lesson.katas.map((kata): Item =>
      kata.type === "concept"
        ? { kind: "concept", kata }
        : { kind: "question", kata, role: "practice" }
    ),
    { kind: "question", kata: lesson.challenge, role: "challenge" },
    { kind: "fix" },
    { kind: "wrap" },
  ]
}

/** How a scored question went on its first pass. */
export type Outcome = "first" | "second" | "missed"

/** Practice and challenge questions count toward the score; the hook and concepts don't. */
export function scoredQuestions(lesson: Lesson): QuestionKata[] {
  return [
    ...lesson.katas.filter((b): b is QuestionKata => b.type !== "concept"),
    lesson.challenge,
  ]
}

export type Summary = Record<Outcome, number> & { total: number }

export function summarize(
  lesson: Lesson,
  results: Record<string, Outcome>
): Summary {
  const summary: Summary = { first: 0, second: 0, missed: 0, total: 0 }
  for (const kata of scoredQuestions(lesson)) {
    summary[results[kata.id] ?? "missed"]++
    summary.total++
  }
  return summary
}

/** How the run went, for the wrap-up: every question right first time, or not. */
export type Run = "perfect" | "done"

export function runFor(s: Summary): Run {
  return s.total > 0 && s.first === s.total ? "perfect" : "done"
}

/** The outcome to record for a question answered correctly. Opening the theory first costs nothing. */
export function outcomeFor(attempts: number): Outcome {
  return attempts > 0 ? "second" : "first"
}

/**
 * Progress as 0–100: the intro is 0, the wrap-up 100. Each screen from the warm-up to the challenge
 * fills its share once it's passed, except a question missed twice: its share waits until the fix
 * round gets it right (`fixed` holds the ids it got right).
 */
export function progressAt(
  items: Item[],
  index: number,
  results: Record<string, Outcome>,
  fixed: string[]
): number {
  const item = items[index]
  if (!item || item.kind === "intro") return 0
  if (item.kind === "wrap") return 100
  const fixAt = items.findIndex((i) => i.kind === "fix")
  const missed = (i: Item) =>
    i.kind === "question" && i.role !== "fix" && results[i.kata.id] === "missed"
  const passed = items
    .slice(1, Math.min(index, fixAt))
    .filter((i) => !missed(i))
  const retried = items
    .slice(fixAt + 1, Math.max(index, fixAt + 1))
    .filter(
      (i) =>
        i.kind === "question" && i.role === "fix" && fixed.includes(i.kata.id)
    )
  return Math.round(
    ((passed.length + retried.length) / Math.max(1, fixAt - 1)) * 100
  )
}

/**
 * The question counter beside the bar: the question on screen (on a concept, the one coming next)
 * out of the lesson's questions, warm-up and challenge included. In the fix round it counts the retries.
 */
export interface QuestionCount {
  current: number
  total: number
  fixing: boolean
}

export function questionAt(
  items: Item[],
  index: number,
  inFix: boolean
): QuestionCount {
  const counted = (role: (r: Role) => boolean) =>
    items.flatMap((item, i) =>
      item.kind === "question" && role(item.role) ? [i] : []
    )
  const list = inFix ? counted((r) => r === "fix") : counted((r) => r !== "fix")
  const ahead = list.findIndex((i) => i >= index)
  return {
    current: ahead === -1 ? list.length : ahead + 1,
    total: list.length,
    fixing: inFix,
  }
}
