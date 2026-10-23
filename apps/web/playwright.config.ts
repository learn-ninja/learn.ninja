import { defineConfig } from "@playwright/test"

// Browser smoke tests against a production build (`next build` first, as CI does).
// Locally they reuse a dev server already running on port 3000; set E2E_PORT to run your own build
// on another port when 3000 is taken by something else.

const PORT = Number(process.env.E2E_PORT ?? 3000)

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Published lessons land in a local PGlite database, not Neon. The production build refuses
    // Better Auth's default secret as soon as a request carries any cookie (the site sets a tz
    // cookie on every page), so the test server gets a fixed one. It signs nothing real.
    env: {
      LEARN_PGLITE_DIR: ".e2e-db",
      BETTER_AUTH_SECRET: "e2e-only-not-a-real-secret-0123456789abcdef",
    },
  },
})
