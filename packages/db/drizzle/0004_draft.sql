CREATE TABLE "lesson_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lesson_draft_expires_at_idx" ON "lesson_draft" USING btree ("expires_at");