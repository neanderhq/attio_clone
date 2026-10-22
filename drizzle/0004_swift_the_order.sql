CREATE TABLE "deal_stage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" uuid,
	"deal_id" integer NOT NULL,
	"from_stage" varchar(20),
	"to_stage" varchar(20) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lost_reason" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lost_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "won_closed_at" timestamp with time zone;--> statement-breakpoint
-- The former New stage is equivalent to Lead. No historical event or close date is inferred.
UPDATE "deals" SET "stage" = 'Lead' WHERE "stage" = 'New';--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_workspace_id_crm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."crm_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_events" ADD CONSTRAINT "deal_stage_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_stage_events_workspace_idx" ON "deal_stage_events" USING btree ("workspace_id","deal_id","changed_at");
