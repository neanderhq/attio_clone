CREATE TABLE "crm_template_settings" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_workspace_seeds" (
	"workspace_id" uuid NOT NULL,
	"version" varchar(80) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_workspace_seeds_workspace_id_version_pk" PRIMARY KEY("workspace_id","version")
);
--> statement-breakpoint
ALTER TABLE "crm_workspace_seeds" ADD CONSTRAINT "crm_workspace_seeds_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE cascade ON UPDATE no action;