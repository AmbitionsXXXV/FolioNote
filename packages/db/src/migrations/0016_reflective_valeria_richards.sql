CREATE TABLE "entry_external_links" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"connection_id" text,
	"external_id" text NOT NULL,
	"url" text,
	"mode" text DEFAULT 'snapshot' NOT NULL,
	"status" text DEFAULT 'up_to_date' NOT NULL,
	"source_revision" text,
	"source_content_hash" text,
	"last_synced_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_external_links_entry_id_uq" UNIQUE("entry_id")
);
--> statement-breakpoint
CREATE TABLE "external_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"workspace_id" text,
	"workspace_name" text,
	"workspace_icon" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"access_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_connections_user_provider_account_uq" UNIQUE("user_id","provider","external_account_id")
);
--> statement-breakpoint
ALTER TABLE "entry_external_links" ADD CONSTRAINT "entry_external_links_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_external_links" ADD CONSTRAINT "entry_external_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_external_links" ADD CONSTRAINT "entry_external_links_connection_id_external_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_connections" ADD CONSTRAINT "external_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_external_links_user_id_provider_idx" ON "entry_external_links" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "external_connections_user_id_idx" ON "external_connections" USING btree ("user_id");