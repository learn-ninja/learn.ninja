// The wrap-up's Share: the lesson's web page with the learner's first tries on it, which dares a
// friend to beat them, as the web's Challenge friend sends (challengeLink in
// packages/player/src/challenge.ts: ?c={first}-{total}). Built by hand, without URL's searchParams,
// which React Native only partly has. The handle (&by=) comes with sign-in in phase 4.

/** The lesson's page at `path` on the web app at `base`, carrying the score, any query left off. */
export function shareLink(
  base: string,
  path: string,
  first: number,
  total: number
): string {
  const page = path.replace(/[?#].*$/, "")
  return `${base.replace(/\/+$/, "")}${page.startsWith("/") ? "" : "/"}${page}?c=${first}-${total}`
}
