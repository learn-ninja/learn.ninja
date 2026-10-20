// Prints the weekly tag report: subjects by lesson count, the top tags in each, and the tags used
// once. Run `npm run tags -w web`. It reads the database the app would: DATABASE_URL (from the
// environment or apps/web/.env.local, as Next reads it) for production, otherwise the local PGlite.

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { formatTagReport, tagReport } from "../lib/explore/tag-report"
import { getDb } from "../lib/publish/store"

const envFile = join(dirname(fileURLToPath(import.meta.url)), "../.env.local")
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || match[1]! in process.env) continue
    process.env[match[1]!] = match[2]!.replace(/^(["'])(.*)\1$/, "$2")
  }
}

console.log(
  `${process.env.DATABASE_URL ? "Database: DATABASE_URL" : "Database: local PGlite"}\n`
)
console.log(formatTagReport(await tagReport(await getDb())))
// PGlite keeps the process alive once opened; the report is printed, so leave.
process.exit(0)
