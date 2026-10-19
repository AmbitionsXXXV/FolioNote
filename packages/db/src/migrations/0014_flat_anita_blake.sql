CREATE TABLE "jp_grammar" (
	"id" text PRIMARY KEY NOT NULL,
	"pattern" text NOT NULL,
	"reading" text,
	"romaji" text NOT NULL,
	"level" text NOT NULL,
	"meaning" text NOT NULL,
	"formation" text NOT NULL,
	"examples" jsonb NOT NULL,
	"tags" jsonb NOT NULL,
	"notes" text,
	"source_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_grammar_level_check" CHECK ("jp_grammar"."level" in ('N5', 'N4', 'N3', 'N2', 'N1'))
);
--> statement-breakpoint
CREATE TABLE "jp_kanji" (
	"character" text PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"strokes" integer,
	"grade" integer,
	"freq" integer,
	"radical" text,
	"radical_number" integer,
	"onyomi" jsonb NOT NULL,
	"kunyomi" jsonb NOT NULL,
	"nanori" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meanings_en" jsonb NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supplementary" boolean DEFAULT false NOT NULL,
	"source_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_kanji_level_check" CHECK ("jp_kanji"."level" in ('N5', 'N4', 'N3', 'N2', 'N1'))
);
--> statement-breakpoint
CREATE TABLE "jp_vocab" (
	"id" text PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"reading" text NOT NULL,
	"romaji" text NOT NULL,
	"meanings_en" jsonb NOT NULL,
	"meanings_zh" jsonb,
	"level" text NOT NULL,
	"jmdict_pos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jmdict_id" integer,
	"other_forms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"other_readings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'openjlpt' NOT NULL,
	"source_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jp_vocab_level_check" CHECK ("jp_vocab"."level" in ('N5', 'N4', 'N3', 'N2', 'N1'))
);
--> statement-breakpoint
CREATE TABLE "jp_vocab_examples" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jp_vocab_examples_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vocab_id" text NOT NULL,
	"position" integer NOT NULL,
	"ja" text NOT NULL,
	"furigana" text,
	"en" text NOT NULL,
	"tatoeba_id" integer
);
--> statement-breakpoint
ALTER TABLE "jp_vocab_examples" ADD CONSTRAINT "jp_vocab_examples_vocab_id_jp_vocab_id_fk" FOREIGN KEY ("vocab_id") REFERENCES "public"."jp_vocab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jp_grammar_level_idx" ON "jp_grammar" USING btree ("level");--> statement-breakpoint
CREATE INDEX "jp_grammar_pattern_idx" ON "jp_grammar" USING btree ("pattern");--> statement-breakpoint
CREATE INDEX "jp_kanji_level_idx" ON "jp_kanji" USING btree ("level");--> statement-breakpoint
CREATE INDEX "jp_vocab_word_idx" ON "jp_vocab" USING btree ("word");--> statement-breakpoint
CREATE INDEX "jp_vocab_reading_idx" ON "jp_vocab" USING btree ("reading");--> statement-breakpoint
CREATE INDEX "jp_vocab_romaji_idx" ON "jp_vocab" USING btree ("romaji");--> statement-breakpoint
CREATE INDEX "jp_vocab_level_idx" ON "jp_vocab" USING btree ("level");--> statement-breakpoint
CREATE INDEX "jp_vocab_jmdict_id_idx" ON "jp_vocab" USING btree ("jmdict_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jp_vocab_examples_vocab_id_position_idx" ON "jp_vocab_examples" USING btree ("vocab_id","position");