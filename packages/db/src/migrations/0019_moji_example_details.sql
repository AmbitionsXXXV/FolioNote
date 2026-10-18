ALTER TABLE "jp_vocab_examples" ALTER COLUMN "en" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jp_vocab_examples" ADD COLUMN "zh" text;--> statement-breakpoint
ALTER TABLE "jp_vocab_examples" ADD COLUMN "source" text DEFAULT 'openjlpt' NOT NULL;--> statement-breakpoint
ALTER TABLE "jp_vocab_examples" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "jp_vocab_examples" ADD COLUMN "source_details" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "jp_vocab_examples_vocab_source_idx" ON "jp_vocab_examples" USING btree ("vocab_id","source","source_id");