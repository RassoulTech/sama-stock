ALTER TABLE "sales" ADD COLUMN "client_ref" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "offline_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sync_flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_business_client_ref_uq" ON "sales" USING btree ("business_id","client_ref") WHERE "sales"."client_ref" is not null;