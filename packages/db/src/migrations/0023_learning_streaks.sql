CREATE TABLE "learning_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text,
	"language" text,
	"points" integer NOT NULL,
	"local_date" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_milestones" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"achieved_on" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_milestones_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_days" integer DEFAULT 0 NOT NULL,
	"longest_days" integer DEFAULT 0 NOT NULL,
	"started_on" text,
	"last_active_on" text,
	"freezes" integer DEFAULT 0 NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"day_start_hour" integer DEFAULT 4 NOT NULL,
	"daily_goal" integer DEFAULT 20 NOT NULL,
	"remind_at" text,
	"languages" text[] DEFAULT '{"ja"}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "daily_logs_user_id_date_idx";--> statement-breakpoint
-- daily_logs was unused so far; drop any duplicate days before the unique index below.
DELETE FROM "daily_logs" a USING "daily_logs" b WHERE a."user_id" = b."user_id" AND a."date" = b."date" AND a."created_at" < b."created_at";--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "goal_points" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "counts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "first_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_activities_user_date_idx" ON "learning_activities" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_logs_user_id_date_unique" ON "daily_logs" USING btree ("user_id","date");