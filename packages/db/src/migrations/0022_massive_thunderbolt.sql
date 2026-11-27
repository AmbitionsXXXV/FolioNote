ALTER TABLE "jp_lexicons" DROP CONSTRAINT "jp_lexicons_user_name_unique";--> statement-breakpoint
ALTER TABLE "jp_lexicons" DROP CONSTRAINT "jp_lexicons_kind_check";--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD COLUMN "context_sentence" text;--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD COLUMN "context_article_id" text;--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD CONSTRAINT "jp_lexicon_entries_context_article_id_jp_articles_id_fk" FOREIGN KEY ("context_article_id") REFERENCES "public"."jp_articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jp_lexicons_user_name_unique" ON "jp_lexicons" USING btree ("user_id","name") WHERE "jp_lexicons"."kind" <> 'notebook';--> statement-breakpoint
CREATE UNIQUE INDEX "jp_lexicons_user_notebook_unique" ON "jp_lexicons" USING btree ("user_id") WHERE "jp_lexicons"."kind" = 'notebook';--> statement-breakpoint
ALTER TABLE "jp_lexicons" ADD CONSTRAINT "jp_lexicons_kind_check" CHECK ("jp_lexicons"."kind" in ('book', 'deck', 'notebook'));