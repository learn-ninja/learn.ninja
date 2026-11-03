import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { mergeContributors } from "./contributors"
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
        { name: "Gene Kamenez", github: "halowe" },
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
    expect(people[2]!.image).toBe(
      "https://avatars.githubusercontent.com/u/4?v=4"
    )
    expect(people[3]).toEqual({
      name: "Someone",
      image: null,
      href: "https://x.com/someone",
    })
  })

  it("leaves out pictures the image optimizer can't fetch", () => {
    const people = mergeContributors(
      [{ ...repo[0]!, avatar_url: "https://example.com/me.png" }],
      []
    )
    expect(people[0]!.image).toBeNull()
  })
})
