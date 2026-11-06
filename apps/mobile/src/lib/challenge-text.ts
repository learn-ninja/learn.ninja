import {
  challengeResult,
  type Challenge,
} from "@workspace/player-core/challenge"
import type { Strings } from "@workspace/player-core/strings"

// A friend's challenge in words, as the web's ChallengeNote and ChallengeVerdict say it
// (packages/player/src/wrap-up.tsx), pure for tests.

/** @handles kept left to right inside a right-to-left sentence (the web wraps them in <bdi>). */
export const isolateHandles = (text: string) =>
  text.replace(/(@[a-z0-9][a-z0-9-]*)/g, "⁦$1⁩")

/** On the title screen: the sender's score to beat. */
export const challengeNote = (challenge: Challenge, t: Strings) =>
  isolateHandles(
    t.challengeFrom(challenge.first, challenge.total, challenge.by)
  )

/** On the wrap-up: whether the learner's first tries beat the score they were sent. */
export function challengeVerdict(
  first: number,
  challenge: Challenge,
  t: Strings
): { won: boolean; text: string } {
  const verdict = challengeResult(first, challenge)
  const text =
    verdict === "won"
      ? t.challengeWon(first, challenge.first, challenge.by)
      : verdict === "tied"
        ? t.challengeTied(first, challenge.by)
        : t.challengeLost(first, challenge.first, challenge.by)
  return { won: verdict === "won", text: isolateHandles(text) }
}
