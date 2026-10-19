ALTER TABLE "jp_vocab" ADD COLUMN "meanings_ja" jsonb;--> statement-breakpoint
ALTER TABLE "jp_vocab" ADD COLUMN "pitch_accents" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jp_vocab" ADD COLUMN "source_details" jsonb;