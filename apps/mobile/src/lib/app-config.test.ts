import { describe, expect, it } from "vitest"

import config, { apiFor, profileOf } from "../../app.config"

const build = (EAS_BUILD_PROFILE?: string) => {
  const before = process.env.EAS_BUILD_PROFILE
  if (EAS_BUILD_PROFILE === undefined) delete process.env.EAS_BUILD_PROFILE
  else process.env.EAS_BUILD_PROFILE = EAS_BUILD_PROFILE
  try {
    return config({ config: {} } as Parameters<typeof config>[0])
  } finally {
    if (before === undefined) delete process.env.EAS_BUILD_PROFILE
    else process.env.EAS_BUILD_PROFILE = before
  }
}

describe("app config", () => {
  it("reads the dev server, with the local-network exception, only in development", () => {
    expect(profileOf({})).toBe("development")
    expect(apiFor("development").baseUrl).toBe("http://localhost:3000")
    const dev = build()
    expect(dev.extra?.apiBaseUrl).toBe("http://localhost:3000")
    expect(
      dev.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsLocalNetworking
    ).toBe(true)
  })

  it("opens learn.ninja's lesson and profile links in every build", () => {
    for (const profile of [undefined, "preview", "production"])
      expect(build(profile).ios?.associatedDomains).toContain(
        "applinks:learn.ninja"
      )
  })

  it("reads learn.ninja over HTTPS with no exception in preview and production", () => {
    for (const profile of ["preview", "production"]) {
      const app = build(profile)
      expect(app.extra?.apiBaseUrl).toBe("https://learn.ninja")
      expect(app.ios?.infoPlist).toBeUndefined()
    }
  })
})
