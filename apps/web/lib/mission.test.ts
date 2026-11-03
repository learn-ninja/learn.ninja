import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { CONTRIBUTORS, loadContributors, mergeContributors } from "./contributors"
import { AREA_GROUPS, areaHref, IDEA_URL } from "./mission"

const contributing = readFileSync(
  join(__dirname, "../../../CONTRIBUTING.md"),
  "utf8"
)

describe("mission areas", () => {
  it("lists the same nine areas as CONTRIBUTING.md", () => {
    const areas = AREA_GROUPS.flatMap((g) => g.areas)
    expect(areas).toHaveLength(9)
    for (const area of areas) {
      expect(contributing, area.title).toContain(`| ${area.title} |`)
    }
  })

  it("sends proposals to the Idea form and the rest to their label", () => {
    const areas = AREA_GROUPS.flatMap((g) => g.areas)
    for (const area of areas) {
      if (area.proposal) expect(areaHref(area)).toBe(IDEA_URL)
      else expect(decodeURIComponent(areaHref(area))).toContain(area.label)
    }
  })
})

describe("mergeContributors", () => {
  const repo = [
    {
      login: "cmicpace",
      type: "User",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      html_url: "https://github.com/cmicpace",
    },
    {
      login: "dependabot[bot]",
      type: "Bot",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      html_url: "https://github.com/apps/dependabot",
    },
    {
      login: "Halowe",
      type: "User",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
      html_url: "https://github.com/halowe",
    },
  ]

  it("keeps GitHub's order, drops bots, and adds listed people after", () => {
    const people = mergeContributors(
      repo,
      [
        { name: "Gene Kamenez", github: "halowe", x: "gkamenz" },
        { name: "Yan Sokalau", github: "yan-sokalau" },
        { name: "Someone", x: "someone" },
      ],
      { "yan-sokalau": "https://avatars.githubusercontent.com/u/4?v=4" }
    )
    expect(people.map((p) => p.name)).toEqual([
      "cmicpace",
      "Gene Kamenez",
      "Yan Sokalau",
      "Someone",
    ])
    // A listed committer keeps their X profile.
    expect(people[1]!.x).toBe("https://x.com/gkamenz")
    expect(people[2]!.image).toBe(
      "https://avatars.githubusercontent.com/u/4?v=4"
    )
    expect(people[3]).toEqual({
      id: "Someone",
      name: "Someone",
      login: null,
      image: null,
      href: "https://x.com/someone",
      x: "https://x.com/someone",
    })
  })

  it("gives everyone a unique id, even when a login matches a listed name", () => {
    const people = mergeContributors(
      [{ ...repo[0]!, login: "Sam", html_url: "https://github.com/Sam" }],
      [{ name: "Sam" }, { name: "Sam" }]
    )
    const ids = people.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("leaves out pictures the image optimizer can't fetch", () => {
    const people = mergeContributors(
      [{ ...repo[0]!, avatar_url: "https://example.com/me.png" }],
      []
    )
    expect(people[0]!.image).toBeNull()
  })
})

describe("loadContributors", () => {
  afterEach(() => vi.unstubAllGlobals())

  const listedNames = CONTRIBUTORS.map((c) => c.name)

  it("falls back to the listed people when GitHub can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    const people = await loadContributors()
    expect(people.map((p) => p.name)).toEqual(listedNames)
    expect(people.every((p) => p.image === null)).toBe(true)
  })

  it("falls back when GitHub answers without a list", async () => {
    // 202 while GitHub computes the list, 204 for a repository with no history: no body to read.
    for (const status of [202, 204, 403]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status }))
      )
      const people = await loadContributors()
      expect(people.map((p) => p.name)).toEqual(listedNames)
    }
  })
})
