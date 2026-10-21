CREATE TABLE "license_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"note" text,
	"recorded_by" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"business_id" text NOT NULL,
	"pack" text NOT NULL,
	"list_price" integer NOT NULL,
	"agreed_price" integer NOT NULL,
	"maintenance_price" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "license_pack" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "license_activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "maintenance_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "license_payments" ADD CONSTRAINT "license_payments_sale_id_license_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."license_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_payments" ADD CONSTRAINT "license_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_payments" ADD CONSTRAINT "license_payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_sales" ADD CONSTRAINT "license_sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_sales" ADD CONSTRAINT "license_sales_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "license_payments_sale_idx" ON "license_payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "license_payments_business_idx" ON "license_payments" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_sales_number_idx" ON "license_sales" USING btree ("number");--> statement-breakpoint
CREATE INDEX "license_sales_business_idx" ON "license_sales" USING btree ("business_id");