// Handles: the public name in /u/{handle}. The rules alone, safe to import in the browser; the
// lookups that need the database are in handles.ts.

export const HANDLE_RULES =
  "3 to 30 characters: lowercase letters, numbers, and hyphens, starting with a letter or number."

/** Paths and names a handle could be confused with. */
export const RESERVED = new Set([
  "admin",
  "api",
  "docs",
  "explore",
  "keep",
  "l",
  "learn",
  "lessons",
  "login",
  "logout",
  "me",
  "ninja",
  "privacy",
  "settings",
  "sign-in",
  "signin",
  "sign-out",
  "signout",
  "log-in",
  "log-out",
  "support",
  "team",
  "teams",
  "terms",
  "u",
  "user",
  "users",
  "www",
])

/** "@Colin_Pace" → "colin-pace"; what's left of a GitHub login or a typed name once the rules apply. */
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

/** Why `handle` can't be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle))
    return `Handles are ${HANDLE_RULES}`
  if (RESERVED.has(handle)) return "That handle is reserved."
  return null
}
