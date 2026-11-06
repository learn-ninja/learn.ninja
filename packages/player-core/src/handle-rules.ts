// Handles: the public name in /u/{handle}. The rules alone, with no DOM or database, shared by the
// web (whose lookups that need the database are in apps/web/lib/auth/handles.ts) and the app.

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

/**
 * Which rule `handle` breaks, as PATCH /api/account names it (docs/reference/api.md), or null when
 * it can be used. Clients switch on the code; the message is the web's English.
 */
export function handleRuleBroken(
  handle: string
): "invalid_handle" | "reserved_handle" | null {
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle)) return "invalid_handle"
  if (RESERVED.has(handle)) return "reserved_handle"
  return null
}

/** Why `handle` can't be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  const broken = handleRuleBroken(handle)
  if (broken === "invalid_handle") return `Handles are ${HANDLE_RULES}`
  if (broken === "reserved_handle") return "That handle is reserved."
  return null
}

// Random handles, for accounts that arrive without one (email log-ins): an English trait and an
// animal by its Japanese name, as a young ninja might be called ("quiet-kitsune", "moonlit-tsuru").
// Chosen by hand so every pair reads well; changed any time in settings.

export const HANDLE_TRAITS = [
  "quiet",
  "silent",
  "swift",
  "nimble",
  "hidden",
  "misty",
  "moonlit",
  "gentle",
  "brave",
  "calm",
  "clever",
  "bold",
  "keen",
  "steady",
  "sly",
  "patient",
  "humble",
  "eager",
  "curious",
  "wise",
  "lucky",
  "sunny",
  "snowy",
  "sleepy",
  "tiny",
  "young",
  "little",
  "noble",
  "loyal",
  "jade",
  "crimson",
  "silver",
  "golden",
  "iron",
  "bamboo",
  "paper",
  "velvet",
  "wandering",
  "dancing",
  "dawn",
] as const

export const HANDLE_ANIMALS = [
  "kitsune", // fox
  "tanuki", // raccoon dog
  "tsuru", // crane
  "karasu", // crow
  "kame", // turtle
  "usagi", // rabbit
  "tora", // tiger
  "saru", // monkey
  "fukuro", // owl
  "neko", // cat
  "inu", // dog
  "kuma", // bear
  "ookami", // wolf
  "taka", // hawk
  "koi", // carp
  "suzume", // sparrow
  "kaeru", // frog
  "tako", // octopus
  "shika", // deer
  "risu", // squirrel
  "nezumi", // mouse
  "uma", // horse
  "ryu", // dragon
  "tombo", // dragonfly
  "hotaru", // firefly
  "iruka", // dolphin
  "kujira", // whale
  "kani", // crab
] as const

/** A random trait and animal, like "quiet-kitsune". Not checked against taken handles: see randomHandle. */
export function randomHandleName(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length)]!
  return `${pick(HANDLE_TRAITS)}-${pick(HANDLE_ANIMALS)}`
}
