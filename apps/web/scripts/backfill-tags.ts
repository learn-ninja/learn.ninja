// Brings every stored lesson up to the current spec and rebuilds its lesson_tag rows, for lessons
// published before the tag table (or a subject) existed. Dry run by default; `--write` applies:
//   npm run tags:backfill -w web
//   npm run tags:backfill -w web -- --write
// Reads the database the app would: DATABASE_URL (the environment or apps/web/.env.local), else
// the local PGlite.

import { DATABASE_LINE } from "./env"
import { backfillTags, formatBackfill } from "../lib/explore/backfill"
import { getDb } from "../lib/publish/store"

const write = process.argv.includes("--write")
console.log(`${DATABASE_LINE}\n`)
console.log(formatBackfill(await backfillTags(await getDb(), { write })))
// PGlite keeps the process alive once opened; the work is done, so leave.
process.exit(0)
