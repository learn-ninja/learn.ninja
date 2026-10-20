// Loads apps/web/.env.local into process.env for scripts that read the database outside Next:
// plain KEY=VALUE lines, quotes stripped, never overriding a variable already set.

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const envFile = join(dirname(fileURLToPath(import.meta.url)), "../.env.local")
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || match[1]! in process.env) continue
    process.env[match[1]!] = match[2]!.replace(/^(["'])(.*)\1$/, "$2")
  }
}

/** Which database the script is about to read, for the first line of its output. */
export const DATABASE_LINE = process.env.DATABASE_URL
  ? "Database: DATABASE_URL"
  : "Database: local PGlite"
