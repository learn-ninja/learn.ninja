import { describe, expect, it } from "vitest"

import { en } from "./locales/en"
import { timeLeft } from "./time"

// The lesson menu's expiry note: days from 24 hours up, hours below.

const HOUR = 3.6e6
const say = (ms: number) => {
  const left = timeLeft(ms)
  return en.expires[left.unit](left.count)
}

describe("timeLeft", () => {
  it("counts days from 24 hours up", () => {
    expect(say(7 * 24 * HOUR - 60_000)).toBe("Expires in 7 days")
    expect(say(36 * HOUR)).toBe("Expires in 2 days")
    expect(say(24 * HOUR)).toBe("Expires in 1 day")
  })

  it("counts hours below a day, at least one", () => {
    expect(say(24 * HOUR - 60_000)).toBe("Expires in 23h")
    expect(say(5 * HOUR)).toBe("Expires in 5h")
    expect(say(10 * 60_000)).toBe("Expires in 1h")
  })
})
