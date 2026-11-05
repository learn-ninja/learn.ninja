import { describe, expect, it } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

import { looksLikeEmail, signInError } from "./sign-in-errors"

const t = stringsFor("en")

describe("the log-in's errors", () => {
  it("says what went wrong by Better Auth's code, in the learner's words", () => {
    expect(signInError({ status: 400, code: "INVALID_OTP" }, t)).toBe(
      t.signIn.wrongCode
    )
    expect(signInError({ status: 400, code: "OTP_EXPIRED" }, t)).toBe(
      t.signIn.expiredCode
    )
    expect(signInError({ status: 403, code: "TOO_MANY_ATTEMPTS" }, t)).toBe(
      t.signIn.tooManyTries
    )
    expect(signInError({ status: 400, code: "INVALID_EMAIL" }, t)).toBe(
      t.signIn.badEmail
    )
    expect(signInError({ status: 429, message: "Too many codes" }, t)).toBe(
      t.signIn.tooManyCodes
    )
    expect(signInError({}, t)).toBe(t.signIn.failed)
  })

  it("checks an address before sending it", () => {
    expect(looksLikeEmail(" ada@example.com ")).toBe(true)
    expect(looksLikeEmail("ada")).toBe(false)
    expect(looksLikeEmail("ada@example")).toBe(false)
  })
})
