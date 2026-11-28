CREATE TABLE "study_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"source_ref" text NOT NULL,
	"title" text NOT NULL,
	"channel_title" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"language" text DEFAULT 'ja' NOT NULL,
	"caption_source" text NOT NULL,
	"caption_file_name" text,
	"segment_count" integer DEFAULT 0 NOT NULL,
	"last_segment_index" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_materials_user_source_unique" UNIQUE("user_id","kind","source_ref"),
	CONSTRAINT "study_materials_kind_check" CHECK ("study_materials"."kind" in ('youtube')),
	CONSTRAINT "study_materials_caption_source_check" CHECK ("study_materials"."caption_source" in ('user_file', 'user_paste'))
);
--> statement-breakpoint
CREATE TABLE "study_segments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "study_segments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"material_id" text NOT NULL,
	"position" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "study_segments_material_position_unique" UNIQUE("material_id","position"),
	CONSTRAINT "study_segments_time_check" CHECK ("study_segments"."end_ms" > "study_segments"."start_ms")
);
--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD COLUMN "context_material_id" text;--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD COLUMN "context_time_ms" integer;--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_segments" ADD CONSTRAINT "study_segments_material_id_study_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."study_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_materials_user_opened_idx" ON "study_materials" USING btree ("user_id","last_opened_at");--> statement-breakpoint
ALTER TABLE "jp_lexicon_entries" ADD CONSTRAINT "jp_lexicon_entries_context_material_id_study_materials_id_fk" FOREIGN KEY ("context_material_id") REFERENCES "public"."study_materials"("id") ON DELETE set null ON UPDATE no action;