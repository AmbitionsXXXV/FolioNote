CREATE TABLE "jp_study_plans" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_new_words" integer DEFAULT 10 NOT NULL,
	"daily_review_limit" integer,
	"deck" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_study_plans_new_words_check" CHECK ("jp_study_plans"."daily_new_words" between 0 and 100),
	CONSTRAINT "jp_study_plans_review_limit_check" CHECK ("jp_study_plans"."daily_review_limit" is null or "jp_study_plans"."daily_review_limit" > 0)
);
--> statement-breakpoint
ALTER TABLE "jp_vocab" ADD COLUMN "audio_path" text;--> statement-breakpoint
ALTER TABLE "jp_vocab_examples" ADD COLUMN "audio_path" text;--> statement-breakpoint
ALTER TABLE "jp_study_plans" ADD CONSTRAINT "jp_study_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;