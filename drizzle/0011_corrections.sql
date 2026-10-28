ALTER TABLE "customer_payments" ADD COLUMN "allocations" jsonb;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "replaces_id" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_replaces_id_sales_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;