import { handleRuleBroken } from "@workspace/player-core/handle-rules"
import type { Strings } from "@workspace/player-core/strings"

export { normalizeHandle } from "@workspace/player-core/handle-rules"

// A handle as the web's settings take it: the web's own rules (packages/player-core's
// handle-rules.ts), checked before asking the server (which checks again), and its refusals in the
// learner's language.

/** Why the handle can't be used, in the learner's words, or null when it can. */
export function handleProblem(handle: string, t: Strings): string | null {
  const broken = handleRuleBroken(handle)
  if (broken === "reserved_handle") return t.account.handleReserved
  if (broken === "invalid_handle") return t.account.handleRules
  return null
}

/**
 * What PATCH /api/account's refusal means, by its error code (docs/reference/api.md): taken (409
 * `handle_taken`), reserved (422 `reserved_handle`), or against the rules (422 `invalid_handle`).
 */
export function handleError(
  status: number,
  error: string | undefined,
  t: Strings
): string {
  if (status === 409 || error === "handle_taken") return t.account.handleTaken
  if (error === "reserved_handle") return t.account.handleReserved
  if (status === 422) return t.account.handleRules
  return t.signIn.failed
}
