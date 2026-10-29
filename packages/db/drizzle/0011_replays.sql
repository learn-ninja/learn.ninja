ALTER TABLE "completion" ADD COLUMN "counted_day" date;--> statement-breakpoint
-- Finishes before this counted on their first day; UTC is close enough for a replay later today.
UPDATE "completion" SET "counted_day" = ("completed_at" AT TIME ZONE 'UTC')::date;
