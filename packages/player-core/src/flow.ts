import {
  isGuess,
  type ConceptKata,
  type Lesson,
  type QuestionKata,
} from "@workspace/spec"

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
        : // A guess before its concept plays as the hook does: one try, not scored, answered at once.
          { kind: "question", kata, role: isGuess(kata) ? "hook" : "practice" }
    ),
    { kind: "question", kata: lesson.challenge, role: "challenge" },
    { kind: "fix" },
    { kind: "wrap" },
  ]
}

/** The warm-up, looked back on from the wrap-up: what the learner guessed, beside the answer. */
export interface FirstGuess {
  prompt: string
  /** What the learner picked, as its text (a picture option's alt). */
  said: string[]
  answer: string[]
  correct: boolean
}

/**
 * The hook's guess and its answer, for the wrap-up: the lesson began by overturning this guess, so
 * it ends by showing it again. Null when no guess was kept (a save from before guesses were) or an
 * option has no words to show.
 */
export function firstGuess(
  lesson: Lesson,
  guesses: Record<string, string[]>
): FirstGuess | null {
  const { hook } = lesson
  const picked = guesses[hook.id]
  if (!picked?.length) return null
  const right = hook.type === "choice" ? hook.correct : [hook.correct]
  const words = (ids: string[]) =>
    ids.flatMap((id) => {
      const o = hook.options.find((o) => o.id === id)
      const text = o?.text ?? (o?.visual && "alt" in o.visual ? o.visual.alt : "")
      return text ? [text] : []
    })
  const said = words(picked)
  const answer = words(right)
  if (said.length !== picked.length || answer.length !== right.length)
    return null
  return {
    prompt: hook.prompt,
    said,
    answer,
    correct:
      picked.length === right.length && picked.every((id) => right.includes(id)),
  }
}

/** How a scored question went on its first pass. */
export type Outcome = "first" | "second" | "missed"

/** Practice and challenge questions count toward the score; the hook, guesses before a concept, and concepts don't. */
export function scoredQuestions(lesson: Lesson): QuestionKata[] {
  return [
    ...lesson.katas.filter(
      (b): b is QuestionKata => b.type !== "concept" && !isGuess(b)
    ),
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
