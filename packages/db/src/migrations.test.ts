import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { expect, it } from "vitest"

import { connectPglite, lesson, MIGRATIONS_DIR } from "./index"

it("has a migration for every schema change", () => {
  // drizzle-kit writes a new migration only when src/schema.ts differs from the last snapshot.
  const out = mkdtempSync(join(tmpdir(), "learn-db-"))
  try {
    cpSync(MIGRATIONS_DIR, out, { recursive: true })
    const log = execFileSync(
      "npx",
      [
        "drizzle-kit",
        "generate",
        "--dialect=postgresql",
        "--schema=src/schema.ts",
        // drizzle-kit only takes a relative path here.
        `--out=${relative(process.cwd(), out)}`,
      ],
      { encoding: "utf8", stdio: "pipe" }
    )
    expect(
      log,
      "src/schema.ts changed: run `npm run generate -w @workspace/db`"
    ).toContain("No schema changes")
    expect(readdirSync(out).sort()).toEqual(readdirSync(MIGRATIONS_DIR).sort())
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}, 30_000)

it("migrates a fresh PGlite database", async () => {
  const db = await connectPglite()
  await db.insert(lesson).values({
    id: "abcd1234",
    slug: "a",
    spec: "0.4",
    lesson: {},
    prepared: {},
    editTokenHash: "x",
  })
  const [row] = await db.select().from(lesson)
  expect(row).toMatchObject({
    visibility: "unlisted",
    hidden: false,
    views: 0,
    likes: 0,
    ownerId: null,
    expiresAt: null,
  })
}, 30_000)
