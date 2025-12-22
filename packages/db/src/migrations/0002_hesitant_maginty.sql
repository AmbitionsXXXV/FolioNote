CREATE TABLE "entry_review_state" (
	"entry_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "version" text DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "rating" text DEFAULT 'good' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "scheduled_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entry_review_state" ADD CONSTRAINT "entry_review_state_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_review_state" ADD CONSTRAINT "entry_review_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_review_state_user_due_idx" ON "entry_review_state" USING btree ("user_id","due_at");