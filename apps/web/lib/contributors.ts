// The people on /mission: everyone who has landed a commit, read from GitHub, plus the people
// listed here. List yourself to show your name and link your X profile, or to be credited without commits
// (design, testing, translations). Both links are optional; a GitHub username brings your picture.

import { SITE } from "./site"

export type Contributor = {
  name: string
  /** GitHub username. */
  github?: string
  /** X (Twitter) handle, without the @. */
  x?: string
}

export const CONTRIBUTORS: Contributor[] = [
  { name: "Colin Pace", github: SITE.makerGithub, x: "cmicpace" },
  { name: "Gene Kamenez", github: "halowe", x: "gkamenz" },
  { name: "Yan Sokalau", github: "yan-sokalau", x: "yan_sokalau" },
  { name: "Nadia Lipskaya", github: "nadiadrako-bit" },
]

/** One face on the wall. */
export type Person = {
  /** Unique on the wall: the GitHub username in lower case, else the listed name. */
  id: string
  /** Shown on hover: the listed name, else the GitHub username. */
  name: string
  /** GitHub username, when there is one. */
  login: string | null
  /** A GitHub profile picture, or null to show the name's first letter. */
  image: string | null
  /** Where the picture links: their GitHub profile, else their X profile. */
  href: string | null
  /** Their X profile, when listed. */
  x: string | null
}

/** The fields of GitHub's contributors list that the wall reads. */
export type RepoContributor = {
  login: string
  type: string
  avatar_url: string
  html_url: string
}

/** Read again once a day. */
const REVALIDATE = 86400

const AVATAR_HOST = "https://avatars.githubusercontent.com/u/"

/** Only pictures next.config.ts lets the image optimizer fetch, so none breaks. */
function avatar(url: string | undefined): string | null {
  return url?.startsWith(AVATAR_HOST) ? url : null
}

const xUrl = (handle: string | undefined) =>
  handle ? `https://x.com/${handle}` : null

/**
 * The repository's committers in GitHub's order (most commits first, bots left out), then the
 * listed people who aren't among them. A listed person who also commits keeps their place and
 * takes their listed name and X profile.
 */
export function mergeContributors(
  repo: RepoContributor[],
  listed: Contributor[],
  pictures: Record<string, string> = {}
): Person[] {
  const byLogin = new Map(
    listed
      .filter((c) => c.github)
      .map((c) => [c.github!.toLowerCase(), c] as const)
  )
  const people = new Map<string, Person>()
  for (const r of repo) {
    if (r.type !== "User") continue
    const id = r.login.toLowerCase()
    if (people.has(id)) continue
    const c = byLogin.get(id)
    people.set(id, {
      id,
      name: c?.name ?? r.login,
      login: r.login,
      image: avatar(r.avatar_url),
      href: r.html_url,
      x: xUrl(c?.x),
    })
  }
  for (const c of listed) {
    const id = c.github?.toLowerCase() ?? c.name
    if (people.has(id)) continue
    people.set(id, {
      id,
      name: c.name,
      login: c.github ?? null,
      image: c.github ? avatar(pictures[id]) : null,
      href: c.github ? `https://github.com/${c.github}` : xUrl(c.x),
      x: xUrl(c.x),
    })
  }
  return [...people.values()]
}

/**
 * A GET from GitHub's API, or null when it fails or doesn't answer with JSON. A `GITHUB_TOKEN`,
 * when set, lifts the limit from 60 requests an hour per IP (shared by every build on Vercel's
 * machines) to 5,000 for the token.
 */
async function github<T>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN
  try {
    const reply = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: REVALIDATE },
    })
    // 202 (still computing) and 204 (no history) are successes without a list.
    if (reply.status !== 200) return null
    return (await reply.json()) as T
  } catch {
    return null
  }
}

/**
 * Everyone on the wall. When GitHub can't be reached, the listed people still show, by initial;
 * the page tries again on its next daily revalidation.
 */
export async function loadContributors(): Promise<Person[]> {
  const repoPath = new URL(SITE.repo).pathname
  const reply = await github<RepoContributor[]>(
    `/repos${repoPath}/contributors?per_page=100`
  )
  const repo = Array.isArray(reply) ? reply : []
  const committers = new Set(repo.map((r) => r.login.toLowerCase()))
  // Listed people without commits aren't in the list above, so their pictures come one by one.
  const missing = CONTRIBUTORS.flatMap((c) =>
    c.github && !committers.has(c.github.toLowerCase()) ? [c.github] : []
  )
  const users = await Promise.all(
    missing.map((login) =>
      github<{ login: string; avatar_url: string }>(`/users/${login}`)
    )
  )
  const pictures: Record<string, string> = {}
  for (const u of users) if (u) pictures[u.login.toLowerCase()] = u.avatar_url
  return mergeContributors(repo, CONTRIBUTORS, pictures)
}
