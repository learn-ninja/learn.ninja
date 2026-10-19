import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"

import { MIGRATIONS_DIR } from "../src/index"

// Applies pending migrations to the database in DATABASE_URL. The web app's build runs it, so each
// deployment migrates the database it uses: give preview deployments their own Neon branch, or a
// preview build migrates production. Without DATABASE_URL there's nothing to migrate: development
// and tests use PGlite, which migrates itself.

const url = process.env.DATABASE_URL
if (!url) {
  console.log("DATABASE_URL isn't set; skipping migrations.")
} else {
  await migrate(drizzle({ client: neon(url) }), {
    migrationsFolder: MIGRATIONS_DIR,
  })
  console.log("Database migrations applied.")
}
