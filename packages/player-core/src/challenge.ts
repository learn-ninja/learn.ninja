// A challenge: the score a learner sends a friend with the lesson's link (?c=4-5&by=handle), which
// the friend's title screen and wrap-up then measure themselves against. Pure, so both players read
// it: the web from its page's query, the app from the link that opened it. The score is self-reported
// in the link; it's a game between friends, not a record.

/** A challenge as the page read it from the link, before the player checks it against the lesson. */
export interface Challenge {
  /** First tries out of `total` scored questions. */
  first: number
  total: number
  /** The sender's handle, when they were logged in. */
  by?: string
}

/** The same shape as an account handle (lib/auth/handle-rules.ts), so nothing else gets shown. */
const HANDLE = /^[a-z0-9][a-z0-9-]{2,29}$/

/** Reads `c` and `by` from a lesson page's query; anything malformed is dropped. */
export function parseChallenge(
  c: string | null | undefined,
  by: string | null | undefined
): Challenge | undefined {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(c ?? "")
  if (!match) return undefined
  const first = Number(match[1])
  const total = Number(match[2])
  if (total < 1 || first > total) return undefined
  return { first, total, ...(by && HANDLE.test(by) ? { by } : {}) }
}

/** The challenge for this lesson: only when its question count still matches, since lessons change. */
export function challengeFor(
  challenge: Challenge | undefined,
  total: number
): Challenge | undefined {
  return challenge && challenge.total === total ? challenge : undefined
}

/** How the friend's first tries compare with the score they were sent. */
export function challengeResult(
  first: number,
  challenge: Challenge
): "won" | "tied" | "lost" {
  if (first > challenge.first) return "won"
  return first === challenge.first ? "tied" : "lost"
}
