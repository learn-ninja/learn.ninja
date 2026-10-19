import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import * as schema from "./schema"

export * from "./schema"
export { schema }

/** A Drizzle database with our schema, whichever driver is underneath. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** The SQL migrations drizzle-kit generates from src/schema.ts. */
export const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../drizzle"
)

/** Neon over HTTP, for production. Migrations run at build time (scripts/migrate.ts), not here. */
export async function connectNeon(url: string): Promise<Db> {
  const { neon } = await import("@neondatabase/serverless")
  const { drizzle } = await import("drizzle-orm/neon-http")
  return drizzle({ client: neon(url), schema })
}

/**
 * PGlite, Postgres compiled to WebAssembly, for development and tests: the same schema with no server.
 * `dataDir` is a folder to keep the data in, or undefined for memory only. Applies migrations first.
 */
export async function connectPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const { migrate } = await import("drizzle-orm/pglite/migrator")
  if (dataDir) await mkdir(dataDir, { recursive: true })
  const db = drizzle({ client: new PGlite(dataDir), schema })
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return db
}
