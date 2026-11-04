import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SMOKE_DIR, smokeTextures } from "./build-smoke.mjs"

describe("assets/smoke", () => {
  it("holds the web's smoke textures (run `npm run smoke -w mobile`)", () => {
    const textures = smokeTextures() as Record<string, Buffer>
    expect(Object.keys(textures).sort()).toEqual(["a", "b"])
    for (const [name, bytes] of Object.entries(textures))
      expect(
        readFileSync(join(SMOKE_DIR, `smoke-${name}.webp`)).equals(bytes)
      ).toBe(true)
  })
})
