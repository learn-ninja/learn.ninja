import type { Mark } from "@workspace/player-core/check"
import { usePlayer } from "./context"

// After checking, answers are marked by color and an icon, which screen readers don't get: the
// same result as words, hidden from sight, next to each marked answer.

/** "correct", "not right", or "partly right" in the player's language; nothing when unmarked. */
export function useMarkWord(): (mark: Mark | undefined) => string | undefined {
  const { t } = usePlayer()
  return (mark) =>
    mark === "correct"
      ? t.markCorrect
      : mark === "wrong"
        ? t.markWrong
        : mark === "partial"
          ? t.markPartial
          : undefined
}

/** The mark as words for screen readers, inside the marked control. */
export function MarkText({ mark }: { mark: Mark | undefined }) {
  const word = useMarkWord()(mark)
  return word ? <span className="sr-only">, {word}</span> : null
}
