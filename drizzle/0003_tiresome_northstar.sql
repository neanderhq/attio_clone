CREATE TABLE "crm_list_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"record_id" integer NOT NULL,
	"stage" varchar(20) DEFAULT 'New' NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_list_grants" (
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access" varchar(10) NOT NULL,
	CONSTRAINT "crm_list_grants_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "crm_list_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"kind" varchar(10) NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"object_type" varchar(10) NOT NULL,
	"visibility" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_list_entries" ADD CONSTRAINT "crm_list_entries_list_id_crm_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_list_grants" ADD CONSTRAINT "crm_list_grants_list_id_crm_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_list_grants" ADD CONSTRAINT "crm_list_grants_user_id_crm_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."crm_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_list_views" ADD CONSTRAINT "crm_list_views_list_id_crm_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lists" ADD CONSTRAINT "crm_lists_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lists" ADD CONSTRAINT "crm_lists_creator_id_crm_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."crm_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_list_entry_unique" ON "crm_list_entries" USING btree ("list_id","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_list_view_name_unique" ON "crm_list_views" USING btree ("list_id","name");--> statement-breakpoint
CREATE INDEX "crm_lists_workspace_idx" ON "crm_lists" USING btree ("workspace_id");