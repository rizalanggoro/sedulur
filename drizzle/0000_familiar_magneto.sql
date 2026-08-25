CREATE TABLE "parent_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	CONSTRAINT "parent_links_parent_child_unique" UNIQUE("parent_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "partnerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_a_id" uuid NOT NULL,
	"partner_b_id" uuid NOT NULL,
	"status" text DEFAULT 'menikah' NOT NULL,
	"married_date" date
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"gender" text DEFAULT '-' NOT NULL,
	"birth_date" date,
	"death_date" date,
	"photo_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_child_id_persons_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_parent_id_persons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_partner_a_id_persons_id_fk" FOREIGN KEY ("partner_a_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_partner_b_id_persons_id_fk" FOREIGN KEY ("partner_b_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;