import { describe, expect, it } from "vitest"

import { accountOf, decodeAccount, encodeAccount } from "./account-info"

describe("the logged-in marker", () => {
  it("round-trips the handle and picture", () => {
    const account = { handle: "ada", image: "/avatars/abc" }
    expect(decodeAccount(encodeAccount(account))).toEqual(account)
    expect(decodeAccount(encodeAccount({ handle: null, image: null }))).toEqual({
      handle: null,
      image: null,
    })
  })

  it("still reads the cookies earlier versions wrote", () => {
    expect(decodeAccount("ada")).toEqual({ handle: "ada", image: null })
    expect(decodeAccount("1")).toEqual({ handle: null, image: null })
    expect(decodeAccount("{not json")).toEqual({ handle: null, image: null })
  })

  it("takes the header's view from the actor", () => {
    expect(accountOf(null)).toBeNull()
    expect(
      accountOf({
        userId: "u1",
        email: "ada@example.com",
        name: "",
        handle: "ada",
        image: null,
        viaApiKey: false,
      })
    ).toEqual({ handle: "ada", image: null })
  })
})
