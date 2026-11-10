import { createHash, randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  base64url,
  callbackURLFor,
  canUseGitHub,
  endingOf,
  toBase64url,
} from "./github-callback"

describe("logging in with GitHub", () => {
  it("ends on the site's page in a real build, the app's scheme against a local server", () => {
    expect(callbackURLFor("https://learn.ninja")).toBe(
      "https://learn.ninja/app/signed-in"
    )
    expect(callbackURLFor("http://localhost:3000")).toBe(
      "learnninja://app/signed-in"
    )
  })

  it("takes the code only from where it expects the sheet to end", () => {
    const at = "https://learn.ninja/app/signed-in"
    expect(endingOf(`${at}?code=abc`, at)).toEqual({
      kind: "code",
      code: "abc",
    })
    expect(endingOf(`${at}?error=access_denied`, at)).toEqual({ kind: "error" })
    expect(endingOf(at, at)).toEqual({ kind: "unexpected" })
    expect(endingOf("https://evil.test/app/signed-in?code=abc", at)).toEqual({
      kind: "unexpected",
    })
    expect(endingOf("not a url", at)).toEqual({ kind: "unexpected" })
    const dev = "learnninja://app/signed-in"
    expect(endingOf(`${dev}?code=xyz`, dev)).toEqual({
      kind: "code",
      code: "xyz",
    })
  })

  it("offers GitHub from iOS 17.4, or on any version against a local server", () => {
    const site = "https://learn.ninja"
    expect(canUseGitHub("17.4", site)).toBe(true)
    expect(canUseGitHub("17.4.1", site)).toBe(true)
    expect(canUseGitHub("18.0", site)).toBe(true)
    expect(canUseGitHub("26.1", site)).toBe(true)
    expect(canUseGitHub("17.3.1", site)).toBe(false)
    expect(canUseGitHub("16.7", site)).toBe(false)
    expect(canUseGitHub("16.7", "http://localhost:3000")).toBe(true)
  })

  it("writes the verifier and challenge as the server reads them", () => {
    for (const n of [0, 1, 2, 3, 31, 32, 33]) {
      const bytes = randomBytes(n)
      expect(base64url(bytes)).toBe(Buffer.from(bytes).toString("base64url"))
    }
    const verifier = base64url(randomBytes(32))
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const digest = createHash("sha256").update(verifier)
    expect(toBase64url(digest.copy().digest("base64"))).toBe(
      digest.digest("base64url")
    )
  })
})
