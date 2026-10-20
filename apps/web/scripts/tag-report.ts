// Prints the weekly tag report: subjects by lesson count, the top tags in each, and the tags used
// once. Run `npm run tags -w web`. It reads the database the app would: DATABASE_URL (from the
// environment or apps/web/.env.local, as Next reads it) for production, otherwise the local PGlite.

import { DATABASE_LINE } from "./env"
import { formatTagReport, tagReport } from "../lib/explore/tag-report"
import { getDb } from "../lib/publish/store"

console.log(`${DATABASE_LINE}\n`)
console.log(formatTagReport(await tagReport(await getDb())))
// PGlite keeps the process alive once opened; the report is printed, so leave.
process.exit(0)
