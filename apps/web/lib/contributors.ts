// The people on /mission: everyone who has landed a commit, read from GitHub, plus the people
// listed here, who help without commits (design, testing, translations). Add yourself with the
// links you want shown; both are optional, and a GitHub username brings your profile picture.

import { SITE } from "./site"

export type Contributor = {
  name: string
  /** GitHub username. */
  github?: string
  /** X (Twitter) handle, without the @. */
  x?: string
}

export const CONTRIBUTORS: Contributor[] = [
  { name: "Gene Kamenez", github: "halowe", x: "gkamenz" },
  { name: "Yan Sokalau", github: "yan-sokalau", x: "yan_sokalau" },
  { name: "Nadia Lipskaya", github: "nadiadrako-bit" },
]

/** One face on the wall. */
export type Person = {
  /** Shown as the picture's label: the listed name, else the GitHub username. */
  name: string
  /** A GitHub profile picture, or null to show the name's first letter. */
  image: string | null
  href: string | null
}

/** The fields of GitHub's contributors list that the wall reads. */
export type RepoContributor = {
  login: string
  type: string
  avatar_url: string
  html_url: string
}

/** Read again once a day: GitHub's unauthenticated limit is 60 requests an hour. */
const REVALIDATE = 86400

const AVATAR_HOST = "https://avatars.githubusercontent.com/u/"

/** Only pictures next.config.ts lets the image optimizer fetch, so none breaks. */
function avatar(url: string | undefined): string | null {
  return url?.startsWith(AVATAR_HOST) ? url : null
}

/**
 * The repository's committers in GitHub's order (most commits first, bots left out), then the
 * listed people who aren't among them. A listed person who also commits keeps their place and
 * takes their listed name.
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
  const seen = new Set<string>()
  const people: Person[] = []
  for (const r of repo) {
    if (r.type !== "User") continue
    const login = r.login.toLowerCase()
    seen.add(login)
    people.push({
      name: byLogin.get(login)?.name ?? r.login,
      image: avatar(r.avatar_url),
      href: r.html_url,
    })
  }
  for (const c of listed) {
    const login = c.github?.toLowerCase()
    if (login && seen.has(login)) continue
    people.push({
      name: c.name,
      image: login ? avatar(pictures[login]) : null,
      href: c.github
        ? `https://github.com/${c.github}`
        : c.x
          ? `https://x.com/${c.x}`
          : null,
    })
  }
  return people
}

async function github<T>(path: string): Promise<T | null> {
  const reply = await fetch(`https://api.github.com${path}`, {
    headers: { accept: "application/vnd.github+json" },
    next: { revalidate: REVALIDATE },
  }).catch(() => null)
  return reply?.ok ? ((await reply.json()) as T) : null
}

/** Everyone on the wall. When GitHub can't be reached, the listed people still show, by initial. */
export async function loadContributors(): Promise<Person[]> {
  const repoPath = new URL(SITE.repo).pathname
  const repo =
    (await github<RepoContributor[]>(
      `/repos${repoPath}/contributors?per_page=100`
    )) ?? []
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
