CREATE TYPE "public"."visibility" AS ENUM('public', 'unlisted', 'team');--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"spec" text NOT NULL,
	"lesson" jsonb NOT NULL,
	"prepared" jsonb NOT NULL,
	"edit_token_hash" text NOT NULL,
	"claim_token_hash" text,
	"owner_id" text,
	"org_id" text,
	"visibility" "visibility" DEFAULT 'unlisted' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "lesson_expires_at_idx" ON "lesson" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "lesson_listing_idx" ON "lesson" USING btree ("visibility","hidden","created_at");