import { describe, expect, it } from "vitest"

import { githubLoginError } from "./login-errors"

describe("a refused GitHub log-in on the website", () => {
  it("says why, by Better Auth's code", () => {
    expect(githubLoginError("ACCOUNT_BANNED")).toBe(
      "This account can't log in."
    )
    expect(githubLoginError("email_not_verified")).toMatch(
      /already has an account/
    )
    expect(githubLoginError(["unable_to_link_account"])).toMatch(
      /already has an account/
    )
    expect(githubLoginError("state_mismatch")).toBe(
      "GitHub didn't log you in. Try again."
    )
  })

  it("says nothing when there's no error, or the person said no on GitHub", () => {
    expect(githubLoginError(undefined)).toBeNull()
    expect(githubLoginError("")).toBeNull()
    expect(githubLoginError("access_denied")).toBeNull()
  })
})
