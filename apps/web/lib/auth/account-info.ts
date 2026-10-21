import type { Actor } from "./actor"

// What the header shows about the visitor, shared by the pages (which know the session) and the
// browser (which keeps a copy in a cookie). Pure, so server and client code can both use it.

export interface AccountInfo {
  /** The handle, or null for a logged-in user who hasn't picked one. */
  handle: string | null
  /** The profile picture's URL (ours or GitHub's), or null. */
  image: string | null
}

/** The header's view of the logged-in user, or null for a visitor. */
export function accountOf(actor: Actor | null): AccountInfo | null {
  return actor ? { handle: actor.handle, image: actor.image } : null
}

/** The marker cookie's value, as JSON so a second field could be added without another format. */
export function encodeAccount(account: AccountInfo): string {
  return JSON.stringify({ h: account.handle, i: account.image })
}

/**
 * Reads the marker cookie's value. Earlier cookies held the handle alone, or "1" for a user
 * without one; those still read as logged in, without a picture, until a page corrects them.
 */
export function decodeAccount(value: string): AccountInfo {
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as { h?: unknown; i?: unknown }
      return {
        handle: typeof parsed.h === "string" && parsed.h ? parsed.h : null,
        image: typeof parsed.i === "string" && parsed.i ? parsed.i : null,
      }
    } catch {
      return { handle: null, image: null }
    }
  }
  return { handle: value === "1" ? null : value || null, image: null }
}
