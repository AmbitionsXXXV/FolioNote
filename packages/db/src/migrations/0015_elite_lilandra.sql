CREATE TABLE "jp_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"text" text NOT NULL,
	"analysis" jsonb,
	"engine_id" text,
	"dict_version" text,
	"analyzed_at" timestamp with time zone,
	"sentence_count" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_articles_source_type_check" CHECK ("jp_articles"."source_type" in ('paste', 'url', 'file'))
);
--> statement-breakpoint
CREATE TABLE "jp_lexicon_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jp_lexicon_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lexicon_id" text NOT NULL,
	"position" integer NOT NULL,
	"headword" text NOT NULL,
	"reading" text,
	"reading_source" text,
	"meanings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pos" text,
	"unit" text,
	"base_form" text NOT NULL,
	"vocab_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_lexicon_entries_word_reading_unique" UNIQUE NULLS NOT DISTINCT("lexicon_id","headword","reading"),
	CONSTRAINT "jp_lexicon_entries_reading_source_check" CHECK ("jp_lexicon_entries"."reading_source" in ('file', 'engine'))
);
--> statement-breakpoint
CREATE TABLE "jp_lexicons" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"level" text,
	"meaning_language" text NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_lexicons_user_name_unique" UNIQUE("user_id","name"),
	CONSTRAINT "jp_lexicons_kind_check" CHECK ("jp_lexicons"."kind" in ('book', 'deck')),
	CONSTRAINT "jp_lexicons_level_check" CHECK ("jp_lexicons"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "jp_lexicons_meaning_language_check" CHECK ("jp_lexicons"."meaning_language" in ('zh', 'en', 'ja'))
);
--> statement-breakpoint
ALTER TABLE "jp_articles" ADD CONSTRAINT "jp_articles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD CONSTRAINT "jp_lexicon_entries_lexicon_id_jp_lexicons_id_fk" FOREIGN KEY ("lexicon_id") REFERENCES "public"."jp_lexicons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD CONSTRAINT "jp_lexicon_entries_vocab_id_jp_vocab_id_fk" FOREIGN KEY ("vocab_id") REFERENCES "public"."jp_vocab"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jp_lexicons" ADD CONSTRAINT "jp_lexicons_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jp_articles_user_id_created_at_idx" ON "jp_articles" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "jp_articles_created_at_idx" ON "jp_articles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jp_lexicon_entries_lexicon_position_idx" ON "jp_lexicon_entries" USING btree ("lexicon_id","position");--> statement-breakpoint
CREATE INDEX "jp_lexicon_entries_base_form_idx" ON "jp_lexicon_entries" USING btree ("base_form");--> statement-breakpoint
CREATE INDEX "jp_lexicon_entries_vocab_id_idx" ON "jp_lexicon_entries" USING btree ("vocab_id");