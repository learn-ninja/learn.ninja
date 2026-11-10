import { describe, expect, it } from "vitest"

import { appleIdToken, cancelledApple } from "./apple-credential"

describe("Sign in with Apple's credential", () => {
  it("sends the token, the nonce itself, and the name when Apple gives one", () => {
    expect(
      appleIdToken(
        {
          identityToken: "token",
          fullName: { givenName: " Ada ", familyName: "Lovelace" },
        },
        "nonce"
      )
    ).toEqual({
      token: "token",
      nonce: "nonce",
      user: { name: { firstName: "Ada", lastName: "Lovelace" } },
    })
  })

  it("sends no name on later sign-ins, when Apple leaves it empty", () => {
    expect(
      appleIdToken(
        {
          identityToken: "token",
          fullName: { givenName: null, familyName: "" },
        },
        "nonce"
      )
    ).toEqual({ token: "token", nonce: "nonce" })
    expect(
      appleIdToken({ identityToken: "token", fullName: null }, "nonce")
    ).toEqual({ token: "token", nonce: "nonce" })
  })

  it("has nothing to send without an identity token", () => {
    expect(appleIdToken({ identityToken: null, fullName: null }, "n")).toBe(
      null
    )
  })

  it("treats a closed sheet as cancelled and anything else as a failure", () => {
    expect(cancelledApple({ code: "ERR_REQUEST_CANCELED" })).toBe(true)
    expect(cancelledApple({ code: "ERR_REQUEST_FAILED" })).toBe(false)
    expect(cancelledApple(new Error("boom"))).toBe(false)
    expect(cancelledApple(null)).toBe(false)
  })
})
