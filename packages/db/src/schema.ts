import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

// The tables, as plans/accounts-v2.md lists them. Ownership, team, and visibility columns exist from
// the start so later phases never migrate live data. After changing this file, run
// `npm run generate -w @workspace/db` and commit the new migration.

export const visibility = pgEnum("visibility", ["public", "unlisted", "team"])

const time = (name: string) => timestamp(name, { withTimezone: true })

export const lesson = pgTable(
  "lesson",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    spec: text("spec").notNull(),
    lesson: jsonb("lesson").notNull(),
    /** Formulas, code, and visuals CSS, prepared once at publish time. */
    prepared: jsonb("prepared").notNull(),
    editTokenHash: text("edit_token_hash").notNull(),
    /** Null once the lesson is claimed into an account. */
    claimTokenHash: text("claim_token_hash"),
    /** Null for anonymous lessons. References the user table once accounts exist. */
    ownerId: text("owner_id"),
    /** Reserved for teams. */
    orgId: text("org_id"),
    visibility: visibility("visibility").notNull().default("unlisted"),
    hidden: boolean("hidden").notNull().default(false),
    plays: integer("plays").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    /** Null means it never expires (owned lessons). */
    expiresAt: time("expires_at"),
  },
  (t) => [
    index("lesson_expires_at_idx").on(t.expiresAt),
    index("lesson_listing_idx").on(t.visibility, t.hidden, t.createdAt),
  ]
)
