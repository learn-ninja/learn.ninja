CREATE TABLE "activity_day" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"lessons" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "activity_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "activity_day" ADD CONSTRAINT "activity_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "activity_day" ("user_id", "day", "lessons")
SELECT "user_id", ("completed_at" AT TIME ZONE 'UTC')::date, count(*)
FROM "completion"
GROUP BY 1, 2
ON CONFLICT DO NOTHING;
