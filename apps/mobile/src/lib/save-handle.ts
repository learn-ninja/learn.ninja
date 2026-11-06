import type { Strings } from "@workspace/player-core/strings"

import { apiFetch } from "./api"
import { handleError } from "./handle"
import { tap } from "./haptics"
import { refreshSession } from "./session"

/**
 * Saves a checked handle as the web's settings do (PATCH /api/account) and refreshes the session
 * so every screen shows it. Returns why the server refused it, in the learner's words, or null once
 * it's saved. Shared by Settings on iOS (the system's prompt) and elsewhere (a text field).
 */
export async function saveHandle(
  handle: string,
  t: Strings
): Promise<string | null> {
  try {
    const res = await apiFetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle }),
    })
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean
      error?: string
    } | null
    if (!res.ok || !body?.ok) return handleError(res.status, body?.error, t)
    tap()
    await refreshSession()
    return null
  } catch {
    return t.signIn.failed
  }
}
