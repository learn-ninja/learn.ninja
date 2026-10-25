import { matchesBlank, type QuestionBrick } from "@workspace/spec"

// Pure answer logic for every question brick: the starting answer, whether it's ready to check,
// checking it, the correct answer, and what to keep on a retry. No React here, so it's easy to test.

export type Answer =
  | { kind: "select"; ids: string[] } // choice, compare, scenario, hotspot
  | { kind: "zones"; zones: Record<string, string[]> } // sort: "pool" plus one zone per group
  | { kind: "sequence"; slots: (string | null)[]; pool: string[] } // order: numbered slots, plus items still to place
  | { kind: "pairs"; links: Record<number, number> } // match: left index → right index
  | { kind: "gaps"; values: Record<string, string> } // blank

export type Mark = "correct" | "wrong" | "partial"

export type MissKey =
  "missOne" | "hotspot" | "hotspotLine" | "sort" | "order" | "match" | "blank"

export interface CheckResult {
  correct: boolean
  /** Scenario only: an "okay" choice. */
  partial?: boolean
  /** Lesson-written feedback (an option's feedback, a mistake's feedback, or a scenario outcome). */
  feedback?: string
  /** Otherwise, which generic player message to show, with a count where it needs one. */
  missKey?: MissKey
  count?: number
  /** Per-element marks, keyed by option, item, hotspot, or blank id ("L0"/"R2" for match sides). */
  marks: Record<string, Mark>
}

export const POOL = "pool"

export function shuffle<T>(
  items: readonly T[],
  random: () => number = Math.random
): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Shuffle, but never hand back the original order (so ordering bricks aren't pre-solved). */
function shuffleAway<T>(items: readonly T[], random: () => number): T[] {
  if (items.length < 2) return [...items]
  const s = shuffle(items, random)
  return s.every((v, i) => v === items[i]) ? [...s.slice(1), s[0]!] : s
}

export function initialAnswer(
  brick: QuestionBrick,
  random: () => number = Math.random
): Answer {
  switch (brick.type) {
    case "sort":
      return {
        kind: "zones",
        zones: Object.fromEntries([
          [
            POOL,
            shuffle(
              brick.items.map((i) => i.id),
              random
            ),
          ],
          ...brick.groups.map((g) => [g.id, [] as string[]]),
        ]),
      }
    case "order":
      return {
        kind: "sequence",
        slots: brick.items.map(() => null),
        pool: shuffleAway(
          brick.items.map((i) => i.id),
          random
        ),
      }
    case "match":
      return { kind: "pairs", links: {} }
    case "blank":
      return {
        kind: "gaps",
        values: Object.fromEntries(brick.blanks.map((b) => [b.id, ""])),
      }
    default:
      return { kind: "select", ids: [] }
  }
}

export function isReady(brick: QuestionBrick, answer: Answer): boolean {
  switch (answer.kind) {
    case "select":
      return answer.ids.length > 0
    case "zones":
      return (answer.zones[POOL] ?? []).length === 0
    case "sequence":
      return answer.slots.every((id) => id !== null)
    case "pairs":
      return (
        brick.type === "match" &&
        Object.keys(answer.links).length === brick.pairs.length
      )
    case "gaps":
      return Object.values(answer.values).every((v) => v !== "")
  }
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

export function checkAnswer(brick: QuestionBrick, answer: Answer): CheckResult {
  switch (brick.type) {
    case "choice":
    case "compare": {
      const picked = answer.kind === "select" ? answer.ids : []
      const correct = brick.type === "choice" ? brick.correct : [brick.correct]
      const ok = sameSet(picked, correct)
      const marks: Record<string, Mark> = {}
      for (const id of picked)
        marks[id] = correct.includes(id) ? "correct" : "wrong"
      if (ok) return { correct: true, marks }
      const wrong = picked.find((id) => !correct.includes(id))
      const feedback = wrong
        ? brick.options.find((o) => o.id === wrong)?.feedback
        : undefined
      return feedback
        ? { correct: false, feedback, marks }
        : { correct: false, missKey: "missOne", marks }
    }
    case "scenario": {
      const picked = answer.kind === "select" ? answer.ids[0] : undefined
      const option = brick.options.find((o) => o.id === picked)
      if (!option) return { correct: false, marks: {} }
      const mark: Mark =
        option.quality === "best"
          ? "correct"
          : option.quality === "okay"
            ? "partial"
            : "wrong"
      return {
        correct: option.quality === "best",
        partial: option.quality === "okay",
        feedback: option.outcome,
        marks: { [option.id]: mark },
      }
    }
    case "hotspot": {
      const picked = answer.kind === "select" ? answer.ids : []
      const ok = sameSet(picked, brick.correct)
      const marks: Record<string, Mark> = {}
      for (const id of picked)
        marks[id] = brick.correct.includes(id) ? "correct" : "wrong"
      return ok
        ? { correct: true, marks }
        : {
            correct: false,
            missKey: brick.visual.kind === "code" ? "hotspotLine" : "hotspot",
            marks,
          }
    }
    case "sort": {
      const zones = answer.kind === "zones" ? answer.zones : {}
      const marks: Record<string, Mark> = {}
      let wrong = 0
      for (const item of brick.items) {
        const ok = (zones[item.group] ?? []).includes(item.id)
        marks[item.id] = ok ? "correct" : "wrong"
        if (!ok) wrong++
      }
      return wrong
        ? { correct: false, missKey: "sort", count: wrong, marks }
        : { correct: true, marks }
    }
    case "order": {
      const seq = answer.kind === "sequence" ? answer.slots : []
      const target = brick.items.map((i) => i.id)
      const accepted = [target, ...(brick.alsoAccept ?? [])]
      const matched = accepted.find(
        (a) => a.join("\u0000") === seq.join("\u0000")
      )
      const marks: Record<string, Mark> = {}
      seq.forEach((id, i) => {
        if (id) marks[id] = matched || target[i] === id ? "correct" : "wrong"
      })
      return matched
        ? { correct: true, marks }
        : { correct: false, missKey: "order", marks }
    }
    case "match": {
      const links = answer.kind === "pairs" ? answer.links : {}
      const marks: Record<string, Mark> = {}
      let wrong = 0
      brick.pairs.forEach((_, i) => {
        const ok = links[i] === i
        marks[`L${i}`] = ok ? "correct" : "wrong"
        if (links[i] !== undefined)
          marks[`R${links[i]}`] = ok ? "correct" : "wrong"
        if (!ok) wrong++
      })
      return wrong
        ? { correct: false, missKey: "match", count: wrong, marks }
        : { correct: true, marks }
    }
    case "blank": {
      const values = answer.kind === "gaps" ? answer.values : {}
      const marks: Record<string, Mark> = {}
      let feedback: string | undefined
      let anyWrong = false
      for (const b of brick.blanks) {
        const v = values[b.id] ?? ""
        const how = { ...b, caseSensitive: brick.caseSensitive }
        const ok = b.accept.some((a) => matchesBlank(a, v, how))
        marks[b.id] = ok ? "correct" : "wrong"
        if (!ok && !anyWrong) {
          anyWrong = true
          feedback = b.mistakes?.find((m) =>
            matchesBlank(m.answer, v, how)
          )?.feedback
        }
      }
      if (!anyWrong) return { correct: true, marks }
      return feedback
        ? { correct: false, feedback, marks }
        : { correct: false, missKey: "blank", marks }
    }
    case "number":
      // Not allowed in v1 lessons (the spec validator rejects them).
      return { correct: false, marks: {} }
  }
}

/** The answer to show after a second miss. */
export function solution(brick: QuestionBrick): Answer {
  switch (brick.type) {
    case "choice":
      return { kind: "select", ids: brick.correct }
    case "compare":
      return { kind: "select", ids: [brick.correct] }
    case "scenario":
      return {
        kind: "select",
        ids: brick.options
          .filter((o) => o.quality === "best")
          .map((o) => o.id)
          .slice(0, 1),
      }
    case "hotspot":
      return { kind: "select", ids: brick.correct }
    case "sort":
      return {
        kind: "zones",
        zones: Object.fromEntries([
          [POOL, []],
          ...brick.groups.map((g) => [
            g.id,
            brick.items.filter((i) => i.group === g.id).map((i) => i.id),
          ]),
        ]),
      }
    case "order":
      return {
        kind: "sequence",
        slots: brick.items.map((i) => i.id),
        pool: [],
      }
    case "match":
      return {
        kind: "pairs",
        links: Object.fromEntries(brick.pairs.map((_, i) => [i, i])),
      }
    case "blank":
      return {
        kind: "gaps",
        values: Object.fromEntries(
          brick.blanks.map((b) => [b.id, b.accept[0]!])
        ),
      }
    case "number":
      return { kind: "select", ids: [] }
  }
}

/** Marks that show the whole solution as correct. */
export function solutionMarks(brick: QuestionBrick): Record<string, Mark> {
  const answer = solution(brick)
  return checkAnswer(brick, answer).marks
}

/**
 * What the learner keeps when they try again: selections are cleared (so they choose afresh),
 * while arrangements stay so they only fix what was wrong. Wrong gaps and wrong order slots empty out.
 */
export function retryAnswer(brick: QuestionBrick, answer: Answer): Answer {
  if (answer.kind === "select") return { kind: "select", ids: [] }
  if (answer.kind === "gaps" && brick.type === "blank") {
    const result = checkAnswer(brick, answer)
    return {
      kind: "gaps",
      values: Object.fromEntries(
        Object.entries(answer.values).map(([id, v]) => [
          id,
          result.marks[id] === "wrong" ? "" : v,
        ])
      ),
    }
  }
  if (answer.kind === "sequence" && brick.type === "order") {
    // Wrong items go back to the pool; the right ones keep their slots.
    const { marks } = checkAnswer(brick, answer)
    const right = (id: string | null) => id !== null && marks[id] === "correct"
    return {
      kind: "sequence",
      slots: answer.slots.map((id) => (right(id) ? id : null)),
      pool: [
        ...answer.pool,
        ...answer.slots.filter((id): id is string => id !== null && !right(id)),
      ],
    }
  }
  return answer
}
