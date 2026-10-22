CREATE TABLE "crm_custom_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"object_type" varchar(10) NOT NULL,
	"name" varchar(80) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"unique" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_custom_values" (
	"field_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"record_id" integer NOT NULL,
	"value" jsonb NOT NULL,
	"unique_key" varchar(500),
	CONSTRAINT "crm_custom_values_field_id_record_id_pk" PRIMARY KEY("field_id","record_id")
);
--> statement-breakpoint
ALTER TABLE "crm_custom_fields" ADD CONSTRAINT "crm_custom_fields_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_custom_values" ADD CONSTRAINT "crm_custom_values_field_id_crm_custom_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."crm_custom_fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_custom_values" ADD CONSTRAINT "crm_custom_values_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_custom_fields_workspace_idx" ON "crm_custom_fields" USING btree ("workspace_id","object_type");--> statement-breakpoint
CREATE INDEX "crm_custom_values_record_idx" ON "crm_custom_values" USING btree ("workspace_id","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_custom_values_unique_idx" ON "crm_custom_values" USING btree ("field_id","unique_key");