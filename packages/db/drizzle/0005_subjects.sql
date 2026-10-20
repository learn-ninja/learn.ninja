CREATE TABLE "lesson_tag" (
	"lesson_id" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "lesson_tag_lesson_id_tag_pk" PRIMARY KEY("lesson_id","tag")
);
--> statement-breakpoint
ALTER TABLE "lesson_tag" ADD CONSTRAINT "lesson_tag_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_tag_tag_idx" ON "lesson_tag" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "lesson_subject_idx" ON "lesson" USING btree (("lesson"->>'subject'),"visibility","hidden","created_at");