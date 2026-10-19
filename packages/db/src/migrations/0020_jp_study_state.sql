CREATE TABLE "jp_study_state" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jp_study_state_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"vocab_id" text,
	"lexicon_entry_id" integer,
	"due_at" timestamp with time zone NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_study_state_user_vocab_unique" UNIQUE("user_id","vocab_id"),
	CONSTRAINT "jp_study_state_user_entry_unique" UNIQUE("user_id","lexicon_entry_id"),
	CONSTRAINT "jp_study_state_one_card_check" CHECK (("jp_study_state"."vocab_id" is null) <> ("jp_study_state"."lexicon_entry_id" is null))
);
--> statement-breakpoint
ALTER TABLE "jp_study_state" ADD CONSTRAINT "jp_study_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jp_study_state" ADD CONSTRAINT "jp_study_state_vocab_id_jp_vocab_id_fk" FOREIGN KEY ("vocab_id") REFERENCES "public"."jp_vocab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jp_study_state" ADD CONSTRAINT "jp_study_state_lexicon_entry_id_jp_lexicon_entries_id_fk" FOREIGN KEY ("lexicon_entry_id") REFERENCES "public"."jp_lexicon_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jp_study_state_user_due_idx" ON "jp_study_state" USING btree ("user_id","due_at");