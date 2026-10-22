CREATE TABLE "crm_record_lifecycle_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"record_type" varchar(10) NOT NULL,
	"record_id" integer NOT NULL,
	"action" varchar(10) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "merged_into_id" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "merged_into_id" integer;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "merged_into_id" integer;--> statement-breakpoint
ALTER TABLE "crm_record_lifecycle_events" ADD CONSTRAINT "crm_record_lifecycle_events_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_record_lifecycle_events" ADD CONSTRAINT "crm_record_lifecycle_events_actor_id_crm_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."crm_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_record_lifecycle_lookup_idx" ON "crm_record_lifecycle_events" USING btree ("workspace_id","record_type","record_id","id");