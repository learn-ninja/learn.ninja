// The links the app shares, built by hand without URL's searchParams, which React Native only
// partly has: a lesson's web page (the lesson menu's Share), and the wrap-up's challenge, which
// carries the learner's first tries to dare a friend to beat them and, signed in, their handle, as
// the web's Challenge friend sends (challengeLink in packages/player/src/challenge.ts:
// ?c={first}-{total}&by={handle}).

/** The lesson's page at `path` on the web app at `base`, any query left off. */
export function lessonLink(base: string, path: string): string {
  const page = path.replace(/[?#].*$/, "")
  return `${base.replace(/\/+$/, "")}${page.startsWith("/") ? "" : "/"}${page}`
}

/** The lesson's page carrying the score, and the sender's handle when they're signed in. */
export function shareLink(
  base: string,
  path: string,
  first: number,
  total: number,
  by?: string | null
): string {
  const by_ = by ? `&by=${encodeURIComponent(by)}` : ""
  return `${lessonLink(base, path)}?c=${first}-${total}${by_}`
}
