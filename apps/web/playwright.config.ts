import { defineConfig } from "@playwright/test"

// Browser smoke tests against a production build (`next build` first, as CI does).
// Locally they reuse a dev server already running on port 3000.

const PORT = 3000

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: "npm run start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Published lessons land in a local PGlite database, not Neon.
    env: { LEARN_PGLITE_DIR: ".e2e-db" },
  },
})
