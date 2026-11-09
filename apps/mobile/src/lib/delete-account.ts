import type { Strings } from "@workspace/player-core/strings"

import { apiFetch } from "./api"
import { forgetSessionLocally } from "./auth-client"

/**
 * Deletes the account for good, as the web's settings do (DELETE /api/account with the account's
 * email typed again to confirm), then forgets the session on the device: the server has already
 * ended it. Returns why it didn't happen, in the learner's words, or null once it's gone. What was
 * played on this phone (its streak days, lessons kept offline) stays, as it does on logging out.
 */
export async function deleteAccount(
  typed: string,
  t: Strings
): Promise<string | null> {
  try {
    const res = await apiFetch("/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    })
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean
      error?: string
    } | null
    if (body?.error === "confirm_mismatch") return t.account.deleteMismatch
    if (!res.ok || !body?.ok) return t.signIn.failed
  } catch {
    return t.signIn.failed
  }
  await forgetSessionLocally().catch(() => {})
  return null
}
