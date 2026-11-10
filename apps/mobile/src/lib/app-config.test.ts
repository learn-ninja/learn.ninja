import { describe, expect, it } from "vitest"

import config, { APP_GROUP, apiFor, profileOf } from "../../app.config"
import { SPLASH_BACKGROUND, SPLASH_SIZE } from "./splash"
import { APP_GROUP as WRITTEN_TO } from "./widget-snapshot"

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

  it("lets learn.ninja end the GitHub log-in sheet in every build", () => {
    for (const profile of [undefined, "preview", "production"])
      expect(build(profile).ios?.associatedDomains).toContain(
        "webcredentials:learn.ninja"
      )
  })

  it("reads learn.ninja over HTTPS with no exception in preview and production", () => {
    for (const profile of ["preview", "production"]) {
      const app = build(profile)
      expect(app.extra?.apiBaseUrl).toBe("https://learn.ninja")
      expect(app.ios?.infoPlist).toBeUndefined()
    }
  })

  it("shares one App Group between the app, its widget, and what the app writes", () => {
    expect(WRITTEN_TO).toBe(APP_GROUP)
    expect(
      build().ios?.entitlements?.["com.apple.security.application-groups"]
    ).toEqual([APP_GROUP])
  })

  it("draws the launch screen's mark where the handoff takes over from it", () => {
    const splash = build().plugins?.find(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen"
    ) as [string, { backgroundColor: string; imageWidth: number }]
    expect(splash[1].imageWidth).toBe(SPLASH_SIZE)
    expect(splash[1].backgroundColor).toBe(SPLASH_BACKGROUND)
  })
})
