CREATE TABLE "crm_memberships" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(10) NOT NULL,
	CONSTRAINT "crm_memberships_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "crm_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "crm_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "crm_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "crm_memberships" ADD CONSTRAINT "crm_memberships_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_memberships" ADD CONSTRAINT "crm_memberships_user_id_crm_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."crm_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sessions" ADD CONSTRAINT "crm_sessions_user_id_crm_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."crm_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;