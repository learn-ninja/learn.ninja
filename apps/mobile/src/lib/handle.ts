import type { Strings } from "@workspace/player-core/strings"

// A handle as the web's settings take it (apps/web/lib/auth/handle-rules.ts): the same tidying and
// rules, checked before asking the server (which checks again), and its refusals in the learner's
// language.

/** "@Ada_Lovelace" → "ada-lovelace". */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "")
}

/** Why the handle can't be used, in the learner's words, or null when it can. */
export function handleProblem(handle: string, t: Strings): string | null {
  return /^[a-z0-9][a-z0-9-]{2,29}$/.test(handle) ? null : t.account.handleRules
}

/** What PATCH /api/account's refusal means: taken (409), reserved, or against the rules (422). */
export function handleError(
  status: number,
  message: string | undefined,
  t: Strings
): string {
  if (status === 409) return t.account.handleTaken
  if (status === 422)
    return message?.includes("reserved")
      ? t.account.handleReserved
      : t.account.handleRules
  return t.signIn.failed
}
