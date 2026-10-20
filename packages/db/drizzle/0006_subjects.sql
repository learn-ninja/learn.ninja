-- Guarded, because a preview deployment applied this migration under an earlier name (0005_subjects)
-- to the same database before it was renumbered behind 0005_completion, so the table and indexes
-- may already exist. Postgres has no IF NOT EXISTS for constraints, hence the DO block.
CREATE TABLE IF NOT EXISTS "lesson_tag" (
	"lesson_id" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "lesson_tag_lesson_id_tag_pk" PRIMARY KEY("lesson_id","tag")
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_tag_lesson_id_lesson_id_fk') THEN
		ALTER TABLE "lesson_tag" ADD CONSTRAINT "lesson_tag_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_tag_tag_idx" ON "lesson_tag" USING btree ("tag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_subject_idx" ON "lesson" USING btree (("lesson"->>'subject'),"visibility","hidden","created_at");
