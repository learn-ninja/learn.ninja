import { defineConfig } from "drizzle-kit"

// `npm run generate -w @workspace/db` writes a new migration to drizzle/ after a schema change.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
})
