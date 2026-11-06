import type { Mark } from "@workspace/player-core/check"
import type { Strings } from "@workspace/player-core/strings"

// A checked answer's mark is a color and an icon, which VoiceOver doesn't get: the same result in
// words, the ones the web's screen-reader text uses (packages/player/src/marks.tsx).

/** "correct", "not right", or "partly right" in the player's language; nothing when unmarked. */
export function markWord(
  t: Pick<Strings, "markCorrect" | "markWrong" | "markPartial">,
  mark: Mark | undefined
): string | undefined {
  return mark === "correct"
    ? t.markCorrect
    : mark === "wrong"
      ? t.markWrong
      : mark === "partial"
        ? t.markPartial
        : undefined
}
