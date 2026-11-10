import { describe, expect, it } from "vitest"

import { appSiteAssociation } from "./app-links"

describe("the apple-app-site-association file", () => {
  it("opens lessons and profiles in the app, and names it for log-in, under the Team ID", () => {
    expect(appSiteAssociation(" ABCDE12345 ")).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["ABCDE12345.ninja.learn.ios"],
            components: [{ "/": "/l/*" }, { "/": "/u/*" }],
          },
        ],
      },
      webcredentials: { apps: ["ABCDE12345.ninja.learn.ios"] },
    })
  })

  it("isn't served without a Team ID, or with one that isn't one", () => {
    expect(appSiteAssociation(undefined)).toBeNull()
    expect(appSiteAssociation("")).toBeNull()
    expect(appSiteAssociation("not-a-team")).toBeNull()
  })
})
