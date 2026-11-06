import { describe, expect, it } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

import { handleError, handleProblem, normalizeHandle } from "./handle"

const t = stringsFor("en")

describe("handles", () => {
  it("tidies and checks a handle as the web's settings do", () => {
    expect(normalizeHandle(" @Ada_Lovelace ")).toBe("ada-lovelace")
    expect(handleProblem("ada", t)).toBeNull()
    expect(handleProblem("ab", t)).toBe(t.account.handleRules)
    // The web's reserved names are caught before asking the server.
    expect(handleProblem("settings", t)).toBe(t.account.handleReserved)
  })

  it("says why the server refused one", () => {
    expect(handleError(409, "handle_taken", t)).toBe(t.account.handleTaken)
    expect(handleError(422, "reserved_handle", t)).toBe(
      t.account.handleReserved
    )
    expect(handleError(422, "invalid_handle", t)).toBe(t.account.handleRules)
    expect(handleError(500, undefined, t)).toBe(t.signIn.failed)
  })
})
