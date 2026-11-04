import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)

/** Stands in for a CommonJS module, so the config can be read without starting Metro. */
function stub(id: string, exports: unknown) {
  const path = require.resolve(id)
  require.cache[path] = { id: path, filename: path, loaded: true, exports } as NodeJS.Module
}

describe("metro config", () => {
  it("sets a rem to 16 points, as on the web, not NativeWind's 14", () => {
    stub("expo/metro-config", { getDefaultConfig: () => ({}) })
    stub("nativewind/metro", {
      withNativeWind: (_config: unknown, options: unknown) => options,
    })
    const options = require("../../metro.config.js") as { inlineRem?: number }
    expect(options.inlineRem).toBe(16)
  })
})
