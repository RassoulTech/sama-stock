ALTER TABLE "businesses" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE INDEX "customer_payments_business_created_idx" ON "customer_payments" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_idx" ON "purchase_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_reserving_orders_idx" ON "sales" USING btree ("business_id","location_id") WHERE "sales"."kind" = 'order' and "sales"."status" in ('new', 'preparing');--> statement-breakpoint
CREATE INDEX "sales_business_customer_idx" ON "sales" USING btree ("business_id","customer_id") WHERE "sales"."customer_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_levels_business_idx" ON "stock_levels" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_slug_unique" UNIQUE("slug");