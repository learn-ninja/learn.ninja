import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// NativeWind turns a component that gains CSS variables after its first render into another one,
// and its development warning about that crashed the blank kata (it couldn't print the props).
// Tailwind 3's shadow utilities are CSS variables, so a class list that adds one on a state change
// (a used chip, a tried option, a settled match tile) does it. The katas' controls keep their
// shadow-xs (tailwind.config.js) in every state, so they have none to take away.

const KATAS = join(__dirname, "../components")

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "ui" ? [] : sources(path)
    return entry.name.endsWith(".tsx") ? [path] : []
  })
}

describe("class names", () => {
  it("never take a shadow away from a control as its state changes", () => {
    const offenders = sources(KATAS).filter((file) =>
      readFileSync(file, "utf8").includes("shadow-none")
    )
    expect(offenders).toEqual([])
  })
})
