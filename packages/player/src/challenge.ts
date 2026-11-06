// The challenge's rules live in player-core (parsing a link's ?c= and ?by=, matching it to the
// lesson, the verdict), shared with the iOS app; the link is built here, with the browser's URL.

export {
  challengeFor,
  challengeResult,
  parseChallenge,
  type Challenge,
} from "@workspace/player-core/challenge"

/** The lesson's link carrying a score, with any query the page had (?ui=, an older ?c=) left off. */
export function challengeLink(
  url: string,
  first: number,
  total: number,
  by?: string | null
): string {
  const link = new URL(url)
  link.search = ""
  link.hash = ""
  link.searchParams.set("c", `${first}-${total}`)
  if (by) link.searchParams.set("by", by)
  return link.toString()
}
