-- Spec 0.8 made tags labels ("Claude Code") with a derived key (`claude-code`): lesson_tag keeps
-- both. Existing rows get their key as a stand-in label until `npm run tags:backfill -w web -- --write`
-- rewrites them from the lessons' upgraded JSON (the column can't be NOT NULL from the start on a
-- table that has rows).
ALTER TABLE "lesson_tag" ADD COLUMN IF NOT EXISTS "label" text;--> statement-breakpoint
UPDATE "lesson_tag" SET "label" = "tag" WHERE "label" IS NULL;--> statement-breakpoint
ALTER TABLE "lesson_tag" ALTER COLUMN "label" SET NOT NULL;
