import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setupFiles: ["./src/test/languages.ts"],
  },
  resolve: {
    alias: {
      // The preparer and the chart renderer are server-only; tests run on the server side too.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
})
