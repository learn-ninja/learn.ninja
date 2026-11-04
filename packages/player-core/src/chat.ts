import type { QuestionKata } from "@workspace/spec"

import type { Answer } from "./check"
import type { Phase } from "./state"

// A chat visual's turns, as both players add to them: a scenario's pick and its reply.

export interface ChatTurn {
  /** Who says it; left out, it's the learner's own line. */
  who?: string
  text: string
  /** A turn added after checking: it slides in, and a reply waits behind typing dots first. */
  added?: "pick" | "reply"
}

/**
 * The turns a scenario's pick adds to its chat: the learner's line, then the other person's reply
 * (the option's outcome). Nothing until the answer has been checked; once revealed, the best path.
 */
export function scenarioTurns(
  kata: QuestionKata,
  answer: Answer,
  phase: Phase
): ChatTurn[] {
  if (kata.type !== "scenario" || kata.visual?.kind !== "chat") return []
  if (phase === "answering") return []
  const picked =
    phase === "revealed"
      ? kata.options.find((o) => o.quality === "best")
      : kata.options.find(
          (o) => answer.kind === "select" && answer.ids[0] === o.id
        )
  if (!picked) return []
  const last = kata.visual.turns[kata.visual.turns.length - 1]!
  return [
    { text: picked.text, added: "pick" },
    { who: last.who, text: picked.outcome, added: "reply" },
  ]
}

/** The initials on a speaker's avatar: the first letter of their first two words. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]!.toUpperCase())
    .join("")
}
